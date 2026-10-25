// A deployment's host OIDC token instead of a stored API token
// (Obelism's www docs/adr/0016): pass one of these as `token`. The space
// needs the Vercel project or GitHub repository connected, under Connected
// deployments on its page on www.obelism.studio. Same as improve's packages/improve/src/oidc.ts.
//
//   import { vercelOidc } from '@obelism/content/oidc'
//   token: vercelOidc()

export type { TokenSource } from './tokenSource'

// What the token must be addressed to: this product.
export const DEFAULT_AUDIENCE = 'https://content.obelism.studio'

// Renewed this long before it expires, so a request never carries one that
// expires on the way.
const RENEW_MARGIN_MS = 60_000

const expiryOf = (token: string) => {
	try {
		const payload = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
		return (JSON.parse(atob(payload)) as { exp?: number }).exp! * 1000
	} catch {
		return 0
	}
}

// One token at a time, reused until shortly before it expires; concurrent
// callers share the request for a new one. For GitHub's, which nothing
// else caches.
const reused = (fetchToken: () => Promise<string>) => {
	let token = ''
	let expiresAt = 0
	let pending: Promise<string> | null = null
	return () => {
		if (token && Date.now() < expiresAt - RENEW_MARGIN_MS)
			return Promise.resolve(token)
		pending ??= fetchToken()
			.then((fresh) => {
				token = fresh
				expiresAt = expiryOf(fresh)
				return fresh
			})
			.finally(() => {
				pending = null
			})
		return pending
	}
}

// On Vercel: the deployment's token for this product, from @vercel/oidc
// (install it next to this package), which caches the exchange for the
// audience itself. In a function it reads the request's token, so call it
// during a request, not at module level.
export const vercelOidc =
	({ audience = DEFAULT_AUDIENCE }: { audience?: string | undefined } = {}) =>
	async () => {
		const { getVercelOidcToken } = await import('@vercel/oidc')
		return getVercelOidcToken({
			audience,
			expirationBufferMs: RENEW_MARGIN_MS,
		})
	}

// In GitHub Actions: the job's token for this product. The job needs
// `permissions: id-token: write`.
export const githubOidc = ({
	audience = DEFAULT_AUDIENCE,
	fetch: fetchImpl = fetch,
}: {
	audience?: string | undefined
	fetch?: typeof fetch | undefined
} = {}) =>
	reused(async () => {
		const env = (
			globalThis as { process?: { env: Record<string, string | undefined> } }
		).process?.env
		const url = env?.ACTIONS_ID_TOKEN_REQUEST_URL
		const bearer = env?.ACTIONS_ID_TOKEN_REQUEST_TOKEN
		if (!url || !bearer)
			throw new Error(
				'githubOidc needs a GitHub Actions job with `permissions: id-token: write`',
			)
		const response = await fetchImpl(
			`${url}&audience=${encodeURIComponent(audience)}`,
			{ headers: { Authorization: `Bearer ${bearer}` } },
		)
		if (!response.ok)
			throw new Error(
				`GitHub refused the OIDC token request (${response.status})`,
			)
		return ((await response.json()) as { value: string }).value
	})
