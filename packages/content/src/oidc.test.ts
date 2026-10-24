import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContentClient } from './client'
import { githubOidc, vercelOidc } from './oidc'

vi.mock('@vercel/oidc', () => ({
	getVercelOidcToken: vi.fn(async () => 'vercel.jwt.token'),
}))

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('host tokens for Content', () => {
	it('are asked for https://content.obelism.studio', async () => {
		const { getVercelOidcToken } = await import('@vercel/oidc')
		await vercelOidc()()
		expect(getVercelOidcToken).toHaveBeenCalledWith(
			expect.objectContaining({ audience: 'https://content.obelism.studio' }),
		)

		vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_URL', 'https://actions.test/t?v=1')
		vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'job')
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ value: 'gh.jwt.token' })),
		)
		expect(await githubOidc({ fetch: fetchMock })()).toBe('gh.jwt.token')
		expect(String(fetchMock.mock.calls[0]![0])).toContain(
			'audience=https%3A%2F%2Fcontent.obelism.studio',
		)
	})

	it('go out per request, with the space and environment when given', async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () =>
				new Response(JSON.stringify({ entry: null }), { status: 404 }),
		)
		const token = vi
			.fn<() => Promise<string>>()
			.mockResolvedValueOnce('first.host.token')
			.mockResolvedValueOnce('second.host.token')
		const content = new ContentClient({
			token,
			space: 'space_site',
			environment: 'production',
			fetch: fetchMock,
		})

		await content.findPage('home')
		await content.findPage('about')

		const headers = (call: number) =>
			fetchMock.mock.calls[call]![1]?.headers as Record<string, string>
		expect(headers(0)).toMatchObject({
			'Obelism-Token': 'first.host.token',
			'Obelism-Space': 'space_site',
			'Obelism-Environment': 'production',
		})
		expect(headers(1)['Obelism-Token']).toBe('second.host.token')
	})

	it('send no place headers when the client names none', async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () =>
				new Response(JSON.stringify({ entry: null }), { status: 404 }),
		)
		await new ContentClient({ token: 'cms_d_x', fetch: fetchMock }).findPage(
			'home',
		)
		const headers = fetchMock.mock.calls[0]![1]?.headers as Record<
			string,
			string
		>
		expect(headers['Obelism-Space']).toBeUndefined()
	})
})
