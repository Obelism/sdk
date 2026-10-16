import { DEFAULT_TIMEOUT, DEFAULT_URL, normalizeUrl } from './config'

// Editing on your own site, outside the visual editor (the CMS's
// docs/site-editing.md). One handler serves everything under `/cms` (the
// `basePath`) on your site:
//
// - `/cms/login?return_to=/pricing` — sends the browser to Obelism Content
//   to sign in, with a PKCE challenge, and…
// - `/cms/callback` — …takes it back: trades the one-time code for a site
//   token, keeps it in an httpOnly cookie, calls `onSignIn` (turn on your
//   framework's draft mode there) and returns to `return_to`.
// - `/cms/logout` — ends the session in the CMS, clears the cookies, calls
//   `onSignOut`.
// - `/cms/api/…` — what the bridge's prompt bar calls in the browser,
//   forwarded to the CMS with the token. The token never reaches page
//   scripts.
//
// While signed in, render drafts by reading the delivery API with the token
// (`readSiteToken`), and the bridge shows the prompt bar with Save and
// Publish.

export const SITE_TOKEN_COOKIE = 'obelism_content_token'
// Readable by the page: tells the bridge the site is being edited, and where
// this handler lives. Holds no secret.
export const SITE_EDITING_COOKIE = 'obelism_content_editing'
const FLOW_COOKIE = 'obelism_content_flow'
// The bridge sends it with every write, which a cross-site form can't.
export const SITE_REQUEST_HEADER = 'x-obelism-content'

const SITE_PATH = '/api/site/v1'
const FLOW_MAX_AGE = 10 * 60

export type SiteEnvironment = 'develop' | 'staging' | 'production'

export type SiteSession = {
	token: string
	expiresAt: string
	spaceId: string
	environment: SiteEnvironment
}

export type SiteEditingOptions = {
	spaceId: string
	// The environment editors change; its preview URL in Space settings must
	// be on this site's origin.
	environment: SiteEnvironment
	// The CMS. Default: https://content.obelism.studio
	url?: string | undefined
	// Where the handler is mounted. Default: /cms
	basePath?: string | undefined
	// This site's public origin, when the request URL doesn't show it (behind
	// a proxy or tunnel). Default: the request's origin.
	siteUrl?: string | undefined
	// Called on the callback request once signed in, and on the logout
	// request, e.g. `(await draftMode()).enable()` in Next.js. Cookies they
	// set join the response in frameworks that collect them (Next.js does).
	onSignIn?: ((session: SiteSession) => void | Promise<void>) | undefined
	onSignOut?: (() => void | Promise<void>) | undefined
	timeout?: number | undefined
	fetch?: typeof fetch | undefined
}

// The site token from a Cookie header (or a framework's cookie store), or
// null when not signed in to edit:
//
//   const token = readSiteToken(request.headers.get('cookie'))
//   const content = token ? new ContentClient({ token, init: { cache: 'no-store' } }) : delivery
export const readSiteToken = (
	cookies:
		| string
		| null
		| undefined
		| { get(name: string): { value: string } | undefined },
): string | null => {
	if (!cookies) return null
	if (typeof cookies !== 'string')
		return cookies.get(SITE_TOKEN_COOKIE)?.value || null
	return parseCookies(cookies).get(SITE_TOKEN_COOKIE) || null
}

const parseCookies = (header: string) => {
	const cookies = new Map<string, string>()
	for (const part of header.split(';')) {
		const index = part.indexOf('=')
		if (index < 0) continue
		const name = part.slice(0, index).trim()
		if (!name || cookies.has(name)) continue
		try {
			cookies.set(name, decodeURIComponent(part.slice(index + 1).trim()))
		} catch {
			cookies.set(name, part.slice(index + 1).trim())
		}
	}
	return cookies
}

type CookieOptions = {
	maxAge: number
	path: string
	httpOnly: boolean
	secure: boolean
}

const serializeCookie = (
	name: string,
	value: string,
	{ maxAge, path, httpOnly, secure }: CookieOptions,
) =>
	[
		`${name}=${encodeURIComponent(value)}`,
		`Path=${path}`,
		`Max-Age=${Math.max(0, Math.floor(maxAge))}`,
		// Also Expires: Next.js re-serializes response cookies when draft mode
		// changes, and drops a Max-Age of 0.
		`Expires=${new Date(maxAge > 0 ? Date.now() + maxAge * 1000 : 0).toUTCString()}`,
		'SameSite=Lax',
		httpOnly && 'HttpOnly',
		secure && 'Secure',
	]
		.filter(Boolean)
		.join('; ')

const base64Url = (bytes: Uint8Array) => {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const randomString = (bytes = 32) =>
	base64Url(crypto.getRandomValues(new Uint8Array(bytes)))

export const pkceChallenge = async (verifier: string) =>
	base64Url(
		new Uint8Array(
			await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
		),
	)

// Only a path on this site: never an open redirect.
export const safeReturnTo = (value: string | null | undefined) =>
	value &&
	value.startsWith('/') &&
	!value.startsWith('//') &&
	!value.includes('\\')
		? value
		: '/'

const normalizeBasePath = (basePath: string) =>
	`/${basePath.replace(/^\/+|\/+$/g, '')}`

// What the browser may reach through `/cms/api/…`: reads, and the writes
// the prompt bar makes. Nothing else of the site API is exposed.
const PROXY_ROUTES: { method: string; pattern: RegExp }[] = [
	{ method: 'GET', pattern: /^session$/ },
	{ method: 'GET', pattern: /^entries\/[\w-]+$/ },
	{ method: 'POST', pattern: /^entries$/ },
	{
		method: 'POST',
		pattern: /^entries\/[\w-]+\/(preview|prompt|save|publish)$/,
	},
]

export type SiteEditingHandler = (request: Request) => Promise<Response>

// The handler for everything under `basePath`. In Next.js:
//
//   // app/cms/[...path]/route.ts
//   const handler = createSiteEditing({
//     spaceId: process.env.CONTENT_SPACE_ID!,
//     environment: 'production',
//     onSignIn: async () => (await draftMode()).enable(),
//     onSignOut: async () => (await draftMode()).disable(),
//   })
//   export { handler as GET, handler as POST }
export const createSiteEditing = ({
	spaceId,
	environment,
	url,
	basePath = '/cms',
	siteUrl,
	onSignIn,
	onSignOut,
	timeout = DEFAULT_TIMEOUT,
	fetch: fetchImpl,
}: SiteEditingOptions): SiteEditingHandler => {
	const cms = normalizeUrl(url || DEFAULT_URL)
	const base = normalizeBasePath(basePath)
	const doFetch: typeof fetch = fetchImpl ?? ((...args) => fetch(...args))

	const callCms = (path: string, init: RequestInit = {}) =>
		doFetch(`${cms}${SITE_PATH}/${path}`, {
			...init,
			redirect: 'manual',
			signal: AbortSignal.timeout(timeout),
		})

	return async (request) => {
		const requestUrl = new URL(request.url)
		const origin = siteUrl ? normalizeUrl(siteUrl) : requestUrl.origin
		const secure = origin.startsWith('https:')
		const redirectUri = `${origin}${base}/callback`
		const cookies = parseCookies(request.headers.get('cookie') ?? '')
		const path = requestUrl.pathname.startsWith(`${base}/`)
			? requestUrl.pathname.slice(base.length + 1)
			: null

		const sessionCookies = (session: { token: string; maxAge: number }) => [
			serializeCookie(SITE_TOKEN_COOKIE, session.token, {
				maxAge: session.maxAge,
				path: '/',
				httpOnly: true,
				secure,
			}),
			serializeCookie(SITE_EDITING_COOKIE, session.token ? base : '', {
				maxAge: session.maxAge,
				path: '/',
				httpOnly: false,
				secure,
			}),
		]
		const clearedCookies = () => sessionCookies({ token: '', maxAge: 0 })

		const redirect = (location: string, setCookies: string[] = []) => {
			const headers = new Headers({
				Location: location,
				'Cache-Control': 'no-store',
			})
			for (const cookie of setCookies) headers.append('Set-Cookie', cookie)
			return new Response(null, { status: 302, headers })
		}

		if (path === 'login' && request.method === 'GET') {
			const state = randomString(16)
			const verifier = randomString(48)
			const flow = JSON.stringify({
				state,
				verifier,
				returnTo: safeReturnTo(requestUrl.searchParams.get('return_to')),
			})
			const connect = new URL(`${cms}/site/connect`)
			connect.search = new URLSearchParams({
				space: spaceId,
				environment,
				redirect_uri: redirectUri,
				state,
				code_challenge: await pkceChallenge(verifier),
				code_challenge_method: 'S256',
			}).toString()
			return redirect(connect.toString(), [
				serializeCookie(FLOW_COOKIE, flow, {
					maxAge: FLOW_MAX_AGE,
					path: base,
					httpOnly: true,
					secure,
				}),
			])
		}

		if (path === 'callback' && request.method === 'GET') {
			const clearFlow = serializeCookie(FLOW_COOKIE, '', {
				maxAge: 0,
				path: base,
				httpOnly: true,
				secure,
			})
			let flow: { state?: unknown; verifier?: unknown; returnTo?: unknown }
			try {
				flow = JSON.parse(cookies.get(FLOW_COOKIE) ?? '')
			} catch {
				flow = {}
			}
			const code = requestUrl.searchParams.get('code')
			if (
				!code ||
				typeof flow.state !== 'string' ||
				typeof flow.verifier !== 'string' ||
				flow.state !== requestUrl.searchParams.get('state')
			) {
				return textResponse(
					400,
					'This sign-in link is invalid or expired. Start again from the login link.',
					[clearFlow],
				)
			}

			const response = await callCms('token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code,
					code_verifier: flow.verifier,
					redirect_uri: redirectUri,
				}),
			})
			if (!response.ok) {
				return textResponse(
					400,
					'Obelism Content did not accept the sign-in. Start again from the login link.',
					[clearFlow],
				)
			}
			const session = (await response.json()) as SiteSession
			await onSignIn?.(session)
			const maxAge = (Date.parse(session.expiresAt) - Date.now()) / 1000
			return redirect(safeReturnTo(flow.returnTo as string), [
				clearFlow,
				...sessionCookies({ token: session.token, maxAge }),
			])
		}

		if (path === 'logout') {
			const token = cookies.get(SITE_TOKEN_COOKIE)
			if (token) {
				await callCms('session', {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${token}` },
				}).catch(() => null)
			}
			await onSignOut?.()
			return redirect(
				safeReturnTo(requestUrl.searchParams.get('return_to')),
				clearedCookies(),
			)
		}

		if (path?.startsWith('api/')) {
			const route = path.slice('api/'.length)
			if (
				!PROXY_ROUTES.some(
					({ method, pattern }) =>
						method === request.method && pattern.test(route),
				)
			) {
				return Response.json({ error: 'Not found' }, { status: 404 })
			}
			if (
				request.method !== 'GET' &&
				request.headers.get(SITE_REQUEST_HEADER) !== '1'
			) {
				return Response.json({ error: 'Forbidden' }, { status: 403 })
			}
			const token = cookies.get(SITE_TOKEN_COOKIE)
			if (!token) {
				return Response.json({ error: 'Not signed in' }, { status: 401 })
			}

			const response = await callCms(route, {
				method: request.method,
				headers: {
					Authorization: `Bearer ${token}`,
					...(request.method !== 'GET' && {
						'Content-Type': 'application/json',
					}),
				},
				...(request.method !== 'GET' && { body: await request.text() }),
			})
			const headers = new Headers({
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store',
			})
			// The session ended in the CMS: stop showing the editing UI.
			if (response.status === 401) {
				for (const cookie of clearedCookies()) {
					headers.append('Set-Cookie', cookie)
				}
			}
			return new Response(await response.text(), {
				status: response.status,
				headers,
			})
		}

		return Response.json({ error: 'Not found' }, { status: 404 })
	}
}

const textResponse = (status: number, text: string, setCookies: string[]) => {
	const headers = new Headers({
		'Content-Type': 'text/plain; charset=utf-8',
		'Cache-Control': 'no-store',
	})
	for (const cookie of setCookies) headers.append('Set-Cookie', cookie)
	return new Response(text, { status, headers })
}
