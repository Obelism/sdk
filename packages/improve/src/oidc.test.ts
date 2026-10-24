import { afterEach, describe, expect, it, vi } from 'vitest'

import { githubOidc, vercelOidc } from './oidc'
import { ImproveServerSDK } from './server'

vi.mock('@vercel/oidc', () => ({
	getVercelOidcToken: vi.fn(async () => 'vercel.jwt.token'),
}))

const jwt = (exp: number) =>
	`h.${btoa(JSON.stringify({ exp })).replace(/=+$/, '')}.s`

const nowSeconds = () => Math.floor(Date.now() / 1000)

afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
})

describe('githubOidc', () => {
	const inActions = () => {
		vi.stubEnv(
			'ACTIONS_ID_TOKEN_REQUEST_URL',
			'https://actions.test/token?api-version=2.0',
		)
		vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'job-bearer')
	}

	it('asks Actions for a token for improve, and reuses it until shortly before it expires', async () => {
		inActions()
		const token = jwt(nowSeconds() + 600)
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ value: token })),
		)
		const source = githubOidc({ fetch: fetchMock })

		expect(await source()).toBe(token)
		expect(await source()).toBe(token)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0]!
		expect(String(url)).toBe(
			'https://actions.test/token?api-version=2.0&audience=https%3A%2F%2Fimprove.obelism.studio',
		)
		expect(init?.headers).toEqual({ Authorization: 'Bearer job-bearer' })
	})

	it('asks again for one about to expire', async () => {
		inActions()
		const fetchMock = vi.fn<typeof fetch>(
			async () =>
				new Response(JSON.stringify({ value: jwt(nowSeconds() + 30) })),
		)
		const source = githubOidc({ fetch: fetchMock })

		await source()
		await source()
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	it('says what the job needs outside Actions, and when GitHub refuses', async () => {
		await expect(githubOidc()()).rejects.toThrow('id-token: write')

		inActions()
		const refused = githubOidc({
			fetch: vi.fn<typeof fetch>(async () => new Response('', { status: 403 })),
		})
		await expect(refused()).rejects.toThrow('(403)')
	})
})

describe('vercelOidc', () => {
	it('asks @vercel/oidc for a token for improve, or the audience given', async () => {
		const { getVercelOidcToken } = await import('@vercel/oidc')

		expect(await vercelOidc()()).toBe('vercel.jwt.token')
		expect(getVercelOidcToken).toHaveBeenLastCalledWith({
			audience: 'https://improve.obelism.studio',
			expirationBufferMs: 60_000,
		})
		await vercelOidc({ audience: 'https://numbers.obelism.studio' })()
		expect(getVercelOidcToken).toHaveBeenLastCalledWith(
			expect.objectContaining({ audience: 'https://numbers.obelism.studio' }),
		)
	})
})

describe('ImproveServerSDK with a token source', () => {
	it('sends what the function gives, per request', async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ tests: {}, flags: {} })),
		)
		vi.stubGlobal('fetch', fetchMock)
		const token = vi.fn(async () => 'host.oidc.token')

		await new ImproveServerSDK({
			organizationId: 'org_1',
			environment: 'production',
			token,
		}).fetchConfig()

		expect(token).toHaveBeenCalledTimes(1)
		const headers = fetchMock.mock.calls[0]![1]?.headers as Record<
			string,
			string
		>
		expect(headers.token).toBe('host.oidc.token')
	})
})
