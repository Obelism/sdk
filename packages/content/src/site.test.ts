import { describe, expect, it, vi } from 'vitest'

import {
	createSiteEditing,
	pkceChallenge,
	readSiteToken,
	safeReturnTo,
	SITE_EDITING_COOKIE,
	SITE_TOKEN_COOKIE,
} from './site'

const CMS = 'https://content.test'
const SITE = 'https://site.test'

const setup = (answer: (url: string, init: RequestInit) => Response) => {
	const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
		answer(String(url), init ?? {}),
	)
	const onSignIn = vi.fn()
	const onSignOut = vi.fn()
	const handler = createSiteEditing({
		spaceId: 'space_1',
		environment: 'production',
		url: CMS,
		onSignIn,
		onSignOut,
		fetch: fetch as typeof globalThis.fetch,
	})
	return { handler, fetch, onSignIn, onSignOut }
}

const get = (path: string, cookie = '', init: RequestInit = {}) =>
	new Request(`${SITE}${path}`, {
		...init,
		headers: { cookie, ...(init.headers as Record<string, string>) },
	})

const cookieValue = (response: Response, name: string) => {
	const header = response.headers
		.getSetCookie()
		.find((cookie) => cookie.startsWith(`${name}=`))
	return (
		header && decodeURIComponent(header.slice(name.length + 1).split(';')[0]!)
	)
}

describe('createSiteEditing', () => {
	it('sends /cms/login to the CMS with PKCE, remembering where to return', async () => {
		const { handler } = setup(() => new Response())
		const response = await handler(get('/cms/login?return_to=/pricing'))
		expect(response.status).toBe(302)

		const location = new URL(response.headers.get('Location')!)
		expect(location.origin + location.pathname).toBe(`${CMS}/site/connect`)
		expect(Object.fromEntries(location.searchParams)).toMatchObject({
			space: 'space_1',
			environment: 'production',
			redirect_uri: `${SITE}/cms/callback`,
			code_challenge_method: 'S256',
		})

		const flow = JSON.parse(cookieValue(response, 'obelism_content_flow')!)
		expect(flow.returnTo).toBe('/pricing')
		expect(flow.state).toBe(location.searchParams.get('state'))
		expect(location.searchParams.get('code_challenge')).toBe(
			await pkceChallenge(flow.verifier),
		)
	})

	it('trades the code for a token on the callback and keeps it httpOnly', async () => {
		const expiresAt = new Date(Date.now() + 3600_000).toISOString()
		const { handler, fetch, onSignIn } = setup(() =>
			Response.json({
				token: 'cms_s_secret',
				expiresAt,
				spaceId: 'space_1',
				environment: 'production',
			}),
		)
		const login = await handler(get('/cms/login?return_to=/pricing'))
		const flowCookie = `obelism_content_flow=${encodeURIComponent(cookieValue(login, 'obelism_content_flow')!)}`
		const { state, verifier } = JSON.parse(
			cookieValue(login, 'obelism_content_flow')!,
		)

		const wrongState = await handler(
			get('/cms/callback?code=cms_c_1&state=other', flowCookie),
		)
		expect(wrongState.status).toBe(400)
		expect(fetch).not.toHaveBeenCalled()

		const response = await handler(
			get(`/cms/callback?code=cms_c_1&state=${state}`, flowCookie),
		)
		expect(response.status).toBe(302)
		expect(response.headers.get('Location')).toBe('/pricing')
		expect(fetch).toHaveBeenCalledWith(
			`${CMS}/api/site/v1/token`,
			expect.objectContaining({ method: 'POST' }),
		)
		expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
			code: 'cms_c_1',
			code_verifier: verifier,
			redirect_uri: `${SITE}/cms/callback`,
		})
		expect(onSignIn).toHaveBeenCalledWith(
			expect.objectContaining({ token: 'cms_s_secret' }),
		)

		const cookies = response.headers.getSetCookie()
		const token = cookies.find((c) => c.startsWith(`${SITE_TOKEN_COOKIE}=`))!
		expect(token).toContain('HttpOnly')
		expect(token).toContain('Secure')
		const editing = cookies.find((c) =>
			c.startsWith(`${SITE_EDITING_COOKIE}=`),
		)!
		expect(editing).not.toContain('HttpOnly')
		expect(cookieValue(response, SITE_EDITING_COOKIE)).toBe('/cms')
	})

	it('forwards only the bridge’s calls, with the token', async () => {
		const { handler, fetch } = setup((url) =>
			url.endsWith('/session')
				? Response.json({ features: ['prompt'] })
				: Response.json({ error: 'Gone' }, { status: 401 }),
		)
		const cookie = `${SITE_TOKEN_COOKIE}=cms_s_secret`

		const session = await handler(get('/cms/api/session', cookie))
		expect(await session.json()).toEqual({ features: ['prompt'] })
		expect(fetch.mock.calls[0]![0]).toBe(`${CMS}/api/site/v1/session`)
		expect(
			(fetch.mock.calls[0]![1]!.headers as Record<string, string>)
				.Authorization,
		).toBe('Bearer cms_s_secret')

		const post = (path: string, headers: Record<string, string> = {}) =>
			handler(get(path, cookie, { method: 'POST', body: '{}', headers }))
		expect((await post('/cms/api/entries/entry_1/save')).status).toBe(403)
		expect(
			(
				await post('/cms/api/entries/entry_1/delete', {
					'x-obelism-content': '1',
				})
			).status,
		).toBe(404)
		await post('/cms/api/entries', { 'x-obelism-content': '1' })
		expect(fetch.mock.calls.at(-1)![0]).toBe(`${CMS}/api/site/v1/entries`)
		for (const action of ['view', 'apply']) {
			await post(`/cms/api/entries/entry_1/${action}`, {
				'x-obelism-content': '1',
			})
			expect(fetch.mock.calls.at(-1)![0]).toBe(
				`${CMS}/api/site/v1/entries/entry_1/${action}`,
			)
		}
		await post('/cms/api/form', { 'x-obelism-content': '1' })
		expect(fetch.mock.calls.at(-1)![0]).toBe(`${CMS}/api/site/v1/form`)
		expect((await handler(get('/cms/api/form', cookie))).status).toBe(404)
		expect((await post('/cms/api/form')).status).toBe(403)
		await handler(get('/cms/api/pages', cookie))
		expect(fetch.mock.calls.at(-1)![0]).toBe(`${CMS}/api/site/v1/pages`)
		expect(
			(await handler(get('/cms/api/pages', cookie, { method: 'POST' }))).status,
		).toBe(404)
		expect((await handler(get('/cms/api/session'))).status).toBe(401)

		// The CMS ended the session: the cookies go too.
		const expired = await post('/cms/api/entries/entry_1/save', {
			'x-obelism-content': '1',
		})
		expect(expired.status).toBe(401)
		expect(cookieValue(expired, SITE_TOKEN_COOKIE)).toBe('')
	})

	it('signs out in the CMS and on the site', async () => {
		const { handler, fetch, onSignOut } = setup(() => Response.json({}))
		const response = await handler(
			get(
				'/cms/logout?return_to=//evil.test',
				`${SITE_TOKEN_COOKIE}=cms_s_secret`,
			),
		)
		expect(fetch).toHaveBeenCalledWith(
			`${CMS}/api/site/v1/session`,
			expect.objectContaining({ method: 'DELETE' }),
		)
		expect(onSignOut).toHaveBeenCalled()
		expect(response.headers.get('Location')).toBe('/')
		expect(cookieValue(response, SITE_TOKEN_COOKIE)).toBe('')
		expect(cookieValue(response, SITE_EDITING_COOKIE)).toBe('')
	})
})

describe('readSiteToken', () => {
	it('reads the token from a Cookie header or a cookie store', () => {
		expect(readSiteToken(`a=1; ${SITE_TOKEN_COOKIE}=cms_s_x`)).toBe('cms_s_x')
		expect(
			readSiteToken({
				get: (name) =>
					name === SITE_TOKEN_COOKIE ? { value: 'cms_s_y' } : undefined,
			}),
		).toBe('cms_s_y')
		expect(readSiteToken(null)).toBeNull()
	})
})

describe('safeReturnTo', () => {
	it('only returns to a path on the site', () => {
		expect(safeReturnTo('/a?b=1')).toBe('/a?b=1')
		for (const value of ['//evil.test', 'https://evil.test', '/\\evil', null]) {
			expect(safeReturnTo(value)).toBe('/')
		}
	})
})
