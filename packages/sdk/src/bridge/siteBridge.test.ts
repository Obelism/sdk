// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SITE_EDITING_COOKIE } from '../site'
import { createSiteBridge, readSiteEditing } from './siteBridge'

type Call = { path: string; body: any; headers: Record<string, string> }

// A window on a site signed in to edit, whose `/cms/api` the test answers.
const site = (answers: Record<string, (body: any) => unknown> = {}) => {
	const calls: Call[] = []
	const reload = vi.fn()
	const assign = vi.fn()
	const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
		const path = url.replace(/^\/cms\/api\//, '')
		const body = init.body ? JSON.parse(init.body as string) : undefined
		calls.push({
			path,
			body,
			headers: (init.headers ?? {}) as Record<string, string>,
		})
		const answer = answers[path]
		if (!answer) return Response.json({ error: 'Not here' }, { status: 404 })
		const value = answer(body)
		return value instanceof Response ? value : Response.json(value)
	})
	const listeners = new Map<string, (event: unknown) => void>()
	const win = {
		document,
		fetch,
		location: { pathname: '/home', search: '', href: '', reload, assign },
		addEventListener: (type: string, listener: (event: unknown) => void) =>
			listeners.set(type, listener),
		removeEventListener: () => {},
		requestAnimationFrame: (callback: () => void) => callback(),
		confirm: () => true,
	}
	return { win: win as unknown as Window, calls, reload, assign, listeners }
}

const SESSION = {
	features: ['prompt', 'save', 'publish'],
	space: {
		defaultLocale: 'en',
		locales: [{ code: 'en' }, { code: 'nl' }],
	},
}

beforeEach(() => {
	document.documentElement.lang = 'nl-NL'
	document.body.innerHTML = `
		<main data-cms-entry="entry_page">
			<section data-cms-uid="hero"><a href="/elsewhere">Hero</a></section>
			<nav data-cms-entry="entry_nav"><div data-cms-uid="link">Link</div></nav>
		</main>`
})
afterEach(() => {
	document.body.innerHTML = ''
	document.cookie = `${SITE_EDITING_COOKIE}=; max-age=0`
})

describe('readSiteEditing', () => {
	it('reads the base path from the editing cookie', () => {
		expect(readSiteEditing(document)).toBeNull()
		document.cookie = `${SITE_EDITING_COOKIE}=${encodeURIComponent('/cms')}`
		expect(readSiteEditing(document)).toBe('/cms')
		document.cookie = `${SITE_EDITING_COOKIE}=${encodeURIComponent('//evil')}`
		expect(readSiteEditing(document)).toBeNull()
	})
})

describe('createSiteBridge', () => {
	it('edits in memory, then saves and publishes what changed', async () => {
		const { win, calls, reload } = site({
			session: () => SESSION,
			'entries/entry_page': () => ({
				content: { title: { en: 'Old', nl: 'Oud' } },
				draftRevision: 3,
			}),
			'entries/entry_page/prompt': ({ content }) => ({
				content: { ...content, title: { ...content.title, nl: 'Nieuw' } },
				summary: 'Changed the title',
			}),
			'entries/entry_page/preview': ({ content }) => ({
				entry: { id: 'entry_page', fields: { title: content.title.nl } },
			}),
			'entries/entry_page/save': () => ({ draftRevision: 4 }),
			'entries/entry_page/publish': () => ({ status: 'published' }),
		})
		const bridge = createSiteBridge(win, '/cms')
		expect(bridge.mode).toBe('site')
		expect(bridge.entryId).toBe('entry_page')
		await vi.waitFor(() =>
			expect(bridge.getState().features).toContain('prompt'),
		)

		const updates: unknown[] = []
		bridge.on('update', ({ entry }) => updates.push(entry))

		const { summary } = await bridge.prompt('Translate the title')
		expect(summary).toBe('Changed the title')
		const prompt = calls.find(({ path }) => path.endsWith('/prompt'))!
		expect(prompt.body).toMatchObject({
			prompt: 'Translate the title',
			locale: 'nl',
			uid: null,
			content: { title: { en: 'Old', nl: 'Oud' } },
		})
		expect(prompt.headers['x-obelism-content']).toBe('1')
		expect(updates).toEqual([{ id: 'entry_page', fields: { title: 'Nieuw' } }])
		expect(bridge.getState()).toMatchObject({ unsaved: true, canUndo: true })

		bridge.undo()
		await vi.waitFor(() => expect(updates).toHaveLength(2))
		expect(bridge.getState()).toMatchObject({ unsaved: false, canUndo: false })

		await bridge.prompt('Translate the title')
		await bridge.save()
		const save = calls.find(({ path }) => path.endsWith('/save'))!
		expect(save.body).toEqual({
			content: { title: { en: 'Old', nl: 'Nieuw' } },
			baseRevision: 3,
		})
		expect(bridge.getState().unsaved).toBe(false)

		await bridge.publish()
		expect(calls.at(-1)!.path).toBe('entries/entry_page/publish')
		// With an `update` listener the page shows the content itself.
		expect(reload).not.toHaveBeenCalled()
	})

	it('acts on the entry around the selected block, while selecting', async () => {
		const { win, calls } = site({
			session: () => SESSION,
			'entries/entry_nav': () => ({ content: {}, draftRevision: 1 }),
			'entries/entry_nav/prompt': () => ({ content: { a: 1 }, summary: '' }),
		})
		const bridge = createSiteBridge(win, '/cms')
		await vi.waitFor(() =>
			expect(bridge.getState().features).toContain('prompt'),
		)

		const link = document.querySelector<HTMLElement>('[data-cms-uid="link"]')!
		link.click()
		expect(bridge.getState().selectedUid).toBeNull()

		bridge.setSelecting(true)
		link.click()
		expect(bridge.getState().selectedUid).toBe('link')
		expect(link.hasAttribute('data-cms-selected')).toBe(true)

		await bridge.prompt('Shorter')
		expect(calls.at(-1)).toMatchObject({
			path: 'entries/entry_nav/prompt',
			body: { uid: 'link' },
		})
	})

	it('reports a save conflict and keeps the changes', async () => {
		const { win } = site({
			session: () => SESSION,
			'entries/entry_page': () => ({ content: {}, draftRevision: 1 }),
			'entries/entry_page/prompt': () => ({ content: { a: 1 }, summary: '' }),
			'entries/entry_page/save': () =>
				Response.json(
					{ error: 'This entry was changed by someone else' },
					{ status: 409 },
				),
		})
		const bridge = createSiteBridge(win, '/cms')
		await vi.waitFor(() => expect(bridge.getState().features).toContain('save'))
		await bridge.prompt('Change it')
		await expect(bridge.save()).rejects.toThrow(/someone else/)
		expect(bridge.getState()).toMatchObject({ unsaved: true, saving: false })
	})

	it('makes a page like this one and opens it', async () => {
		const { win, calls, assign } = site({
			session: () => ({
				...SESSION,
				features: [...SESSION.features, 'create'],
			}),
			entries: () => ({
				entryId: 'entry_new',
				path: 'solutions/agencies',
				summary: 'A page for agencies',
			}),
		})
		const bridge = createSiteBridge(win, '/cms', {
			pagePath: (path, locale) => `/${locale}/${path}`,
		})
		await vi.waitFor(() =>
			expect(bridge.getState().features).toContain('create'),
		)

		const result = await bridge.createPage(
			'/solutions/agencies',
			' For agencies ',
		)
		expect(result).toEqual({
			summary: 'A page for agencies',
			entryId: 'entry_new',
			path: 'solutions/agencies',
			url: '/nl/solutions/agencies',
		})
		const create = calls.find(({ path }) => path === 'entries')!
		expect(create.body).toEqual({
			path: '/solutions/agencies',
			prompt: 'For agencies',
			locale: 'nl',
			from: 'entry_page',
		})
		expect(create.headers['x-obelism-content']).toBe('1')
		expect(assign).toHaveBeenCalledWith('/nl/solutions/agencies')
		expect(bridge.getState().prompting).toBe(false)
	})

	it('only makes pages with the feature, and without unsaved changes', async () => {
		const reader = createSiteBridge(
			site({ session: () => SESSION }).win,
			'/cms',
		)
		await vi.waitFor(() =>
			expect(reader.getState().features).toContain('prompt'),
		)
		await expect(reader.createPage('about', 'x')).rejects.toThrow(
			'You may not add pages here',
		)

		const { win, calls } = site({
			session: () => ({
				...SESSION,
				features: [...SESSION.features, 'create'],
			}),
			'entries/entry_page': () => ({ content: {}, draftRevision: 1 }),
			'entries/entry_page/prompt': () => ({ content: { a: 1 }, summary: '' }),
		})
		const bridge = createSiteBridge(win, '/cms')
		await vi.waitFor(() =>
			expect(bridge.getState().features).toContain('create'),
		)
		await expect(bridge.createPage(' ', 'x')).rejects.toThrow(
			'Say where the page goes',
		)
		await bridge.prompt('Change it')
		await expect(bridge.createPage('about', 'x')).rejects.toThrow(
			'Save or undo your changes',
		)
		expect(calls.some(({ path }) => path === 'entries')).toBe(false)
	})

	it('signs out through the site’s logout', () => {
		const { win } = site({ session: () => SESSION })
		const bridge = createSiteBridge(win, '/cms')
		bridge.signOut()
		expect(win.location.href).toBe('/cms/logout?return_to=%2Fhome')
	})
})
