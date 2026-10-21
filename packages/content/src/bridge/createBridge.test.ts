// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createBridge, readStats, wrapScriptBridge } from './createBridge'

const CMS = 'https://content.obelism.studio'
const entry = { id: 'entry_1', fields: { title: 'Live' } }

// A window inside the editor's iframe: jsdom's document, a fake parent, and
// messages delivered by hand.
const frame = (
	search = '?cms_preview=1&cms_entry=entry_1&cms_environment=develop',
) => {
	const parent = { postMessage: vi.fn() }
	const messageListeners = new Set<(event: MessageEvent) => void>()
	const reload = vi.fn()
	const win = {
		parent,
		document,
		location: { search, href: `https://site.test/home${search}`, reload },
		addEventListener: (_: string, listener: (event: MessageEvent) => void) =>
			messageListeners.add(listener),
		removeEventListener: (_: string, listener: (event: MessageEvent) => void) =>
			messageListeners.delete(listener),
		requestAnimationFrame: (callback: () => void) => callback(),
	}
	const receive = (
		data: unknown,
		{
			origin = CMS,
			source = parent as unknown,
		}: { origin?: string; source?: unknown } = {},
	) => {
		for (const listener of messageListeners) {
			listener({ data, origin, source } as MessageEvent)
		}
	}
	return {
		win: win as unknown as Window,
		parent,
		receive,
		reload,
		messageListeners,
	}
}

const fromEditor = (type: string, data: Record<string, unknown> = {}) => ({
	source: 'obelism-content-editor',
	type,
	...data,
})

beforeEach(() => {
	document.body.innerHTML = `
		<section data-cms-uid="b_1"><a href="/elsewhere" id="link">Hero</a></section>
		<section data-cms-uid='b_"2'>Odd uid</section>
	`
})

afterEach(() => {
	document.head.innerHTML = ''
})

describe('createBridge', () => {
	it('does nothing outside the editor', () => {
		const top = frame()
		;(top.win as { parent: unknown }).parent = top.win
		const bridge = createBridge(top.win, CMS)
		expect(bridge.isEditing).toBe(false)
		expect(top.messageListeners.size).toBe(0)

		const notPreview = frame('')
		expect(createBridge(notPreview.win, CMS).isEditing).toBe(false)
		expect(notPreview.parent.postMessage).not.toHaveBeenCalled()
	})

	it('says it is ready, to the CMS origin only', () => {
		const { win, parent, receive } = frame()
		const bridge = createBridge(win, CMS)

		expect(bridge).toMatchObject({
			isEditing: true,
			entryId: 'entry_1',
			environment: 'develop',
		})
		expect(parent.postMessage).toHaveBeenCalledWith(
			{
				source: 'obelism-content-bridge',
				type: 'ready',
				url: 'https://site.test/home?cms_preview=1&cms_entry=entry_1&cms_environment=develop',
			},
			CMS,
		)

		receive(fromEditor('connect'))
		expect(parent.postMessage).toHaveBeenCalledTimes(2)
		bridge.destroy()
	})

	it('hands live entries to listeners, and ignores other origins and windows', () => {
		const { win, receive } = frame()
		const bridge = createBridge(win, CMS)
		const listener = vi.fn()
		const off = bridge.on('update', listener)

		receive(fromEditor('update', { entry }), { origin: 'https://evil.test' })
		receive(fromEditor('update', { entry }), { source: {} })
		receive({ ...fromEditor('update', { entry }), source: 'someone-else' })
		expect(listener).not.toHaveBeenCalled()

		receive(fromEditor('update', { entry, selectedUid: 'b_1' }))
		expect(listener).toHaveBeenCalledWith({ entry, selectedUid: 'b_1' })
		expect(
			document
				.querySelector('[data-cms-uid="b_1"]')!
				.hasAttribute('data-cms-selected'),
		).toBe(true)

		off()
		receive(fromEditor('update', { entry }))
		expect(listener).toHaveBeenCalledTimes(1)
		bridge.destroy()
	})

	it('tells the editor which block was clicked, instead of following links', () => {
		const { win, parent } = frame()
		const bridge = createBridge(win, CMS)

		const click = new MouseEvent('click', { bubbles: true, cancelable: true })
		document.getElementById('link')!.dispatchEvent(click)

		expect(click.defaultPrevented).toBe(true)
		expect(parent.postMessage).toHaveBeenLastCalledWith(
			{ source: 'obelism-content-bridge', type: 'select', uid: 'b_1' },
			CMS,
		)
		bridge.destroy()
	})

	it('selects the block the editor selected, whatever its uid', () => {
		const { win, receive } = frame()
		const bridge = createBridge(win, CMS)
		Element.prototype.scrollIntoView = vi.fn()

		receive(fromEditor('select', { uid: 'b_"2' }))

		const selected = document.querySelectorAll('[data-cms-selected]')
		expect(selected).toHaveLength(1)
		expect(selected[0]!.textContent).toBe('Odd uid')
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
		bridge.destroy()
	})

	it('reloads after a save only while nobody listens for updates', () => {
		const { win, receive, reload } = frame()
		const bridge = createBridge(win, CMS)
		const saved = vi.fn()
		bridge.on('saved', saved)

		receive(fromEditor('saved'))
		expect(saved).toHaveBeenCalledTimes(1)
		expect(reload).toHaveBeenCalledTimes(1)

		bridge.on('update', () => {})
		receive(fromEditor('published'))
		expect(reload).toHaveBeenCalledTimes(1)
		bridge.destroy()
	})

	it('removes what it added when destroyed', () => {
		const { win, messageListeners } = frame()
		const bridge = createBridge(win, CMS)
		expect(document.head.querySelector('style')).not.toBeNull()

		bridge.destroy()
		expect(document.head.querySelector('style')).toBeNull()
		expect(messageListeners.size).toBe(0)
	})
})

describe('wrapScriptBridge', () => {
	it('forwards the script bridge, and only takes updates once asked', () => {
		const registered: Record<string, ((payload: unknown) => void)[]> = {}
		const script = {
			isEditing: true,
			entryId: 'entry_1',
			on: (event: string, listener: (payload: unknown) => void) => {
				;(registered[event] ??= []).push(listener)
			},
		}
		const bridge = wrapScriptBridge(
			script,
			new URLSearchParams('cms_environment=staging'),
		)
		expect(bridge).toMatchObject({ isEditing: true, environment: 'staging' })
		expect(registered.update).toBeUndefined()

		const listener = vi.fn()
		bridge.on('update', listener)
		bridge.on('update', () => {})
		expect(registered.update).toHaveLength(1)

		registered.update![0]!({ entry })
		expect(listener).toHaveBeenCalledWith({ entry, selectedUid: null })
	})
})

describe('prompts', () => {
	const offerPrompts = (receive: ReturnType<typeof frame>['receive']) =>
		receive(fromEditor('features', { features: ['prompt'] }))

	it('sends the prompt for the selected block and resolves with the answer', async () => {
		const { win, parent, receive } = frame()
		const bridge = createBridge(win, CMS)
		const changes = vi.fn()
		bridge.on('change', changes)
		offerPrompts(receive)
		receive(fromEditor('select', { uid: 'b_1' }))

		const result = bridge.prompt('  Shorter please ')
		expect(bridge.getState()).toMatchObject({
			features: ['prompt'],
			selectedUid: 'b_1',
			prompting: true,
		})
		const sent = parent.postMessage.mock.lastCall![0]
		expect(sent).toEqual({
			source: 'obelism-content-bridge',
			type: 'prompt',
			id: expect.any(String),
			prompt: 'Shorter please',
			uid: 'b_1',
		})

		receive(fromEditor('promptResult', { id: 'someone-else', ok: true }))
		receive(
			fromEditor('promptResult', { id: sent.id, ok: true, summary: 'Done' }),
		)
		await expect(result).resolves.toEqual({ summary: 'Done' })
		expect(bridge.getState().prompting).toBe(false)
		expect(changes).toHaveBeenCalled()
		bridge.destroy()
	})

	it("rejects with the editor's reason", async () => {
		const { win, parent, receive } = frame()
		const bridge = createBridge(win, CMS)
		offerPrompts(receive)

		const result = bridge.prompt('x', { uid: null })
		const sent = parent.postMessage.mock.lastCall![0]
		expect(sent.uid).toBeNull()
		receive(
			fromEditor('promptResult', {
				id: sent.id,
				ok: false,
				error: 'No rights',
			}),
		)
		await expect(result).rejects.toThrow('No rights')
		bridge.destroy()
	})

	it('only prompts when the editor offers it', async () => {
		const { win, receive } = frame()
		const bridge = createBridge(win, CMS)
		await expect(bridge.prompt('x')).rejects.toThrow('does not offer')
		offerPrompts(receive)
		await expect(bridge.prompt('   ')).rejects.toThrow('Say what to change')
		bridge.destroy()
		await expect(createBridge(frame('').win, CMS).prompt('x')).rejects.toThrow(
			'inside the visual editor',
		)
	})

	it('leaves JSON, the form and the pages to editing on the site', async () => {
		const { win, receive } = frame()
		const bridge = createBridge(win, CMS)
		offerPrompts(receive)
		await expect(bridge.view()).rejects.toThrow('on the site')
		await expect(bridge.applyJson({ title: 'x' })).rejects.toThrow(
			'on the site',
		)
		await expect(bridge.pages()).rejects.toThrow('on the site')
		const container = document.createElement('div')
		const onError = vi.fn()
		bridge.openForm(container, { onError }).close()
		await vi.waitFor(() =>
			expect(onError).toHaveBeenCalledWith(
				'Only while signed in to edit on the site',
			),
		)
		expect(container.children).toHaveLength(0)
		expect(() =>
			bridge.openPage({
				entryId: 'e',
				name: 'E',
				contentType: 'page',
				status: 'draft',
				path: 'e',
				url: '/e',
				product: null,
				collection: null,
			}),
		).not.toThrow()
		bridge.destroy()
	})

	it('gives up when the editor never answers', async () => {
		vi.useFakeTimers()
		const { win, receive } = frame()
		const bridge = createBridge(win, CMS)
		offerPrompts(receive)
		const result = bridge.prompt('x')
		vi.advanceTimersByTime(120_000)
		await expect(result).rejects.toThrow('in time')
		vi.useRealTimers()
		bridge.destroy()
	})

	it('tracks undo, and sends undo and selection to the editor', () => {
		const { win, parent, receive } = frame()
		const bridge = createBridge(win, CMS)
		receive(fromEditor('promptState', { canUndo: true }))
		expect(bridge.getState().canUndo).toBe(true)

		bridge.undo()
		expect(parent.postMessage).toHaveBeenLastCalledWith(
			{ source: 'obelism-content-bridge', type: 'undo' },
			CMS,
		)
		bridge.select('b_1')
		expect(bridge.getState().selectedUid).toBe('b_1')
		bridge.select(null)
		expect(parent.postMessage).toHaveBeenLastCalledWith(
			{ source: 'obelism-content-bridge', type: 'select', uid: null },
			CMS,
		)
		expect(document.querySelector('[data-cms-selected]')).toBeNull()
		bridge.destroy()
	})
})

describe('click rates', () => {
	const STATS = { b_1: { clicks: 37, clickers: 5, viewers: 21, rate: 0.24 } }
	const overlay = () => document.querySelector('[data-obelism-stats]')
	const labels = () =>
		[...(overlay()?.shadowRoot?.querySelectorAll('.badge') ?? [])].map(
			(badge) => badge.textContent,
		)

	beforeEach(() => {
		document.querySelector('[data-cms-uid="b_1"]')!.getBoundingClientRect =
			() =>
				({ top: 10, bottom: 60, right: 300, width: 300, height: 50 }) as DOMRect
	})

	it('keeps the rates and the switch in its state, and shows them on the page', () => {
		const { win, receive } = frame()
		const bridge = createBridge(win, CMS)
		const change = vi.fn()
		bridge.on('change', change)

		receive(fromEditor('stats', { stats: STATS, visible: true }))
		expect(bridge.getState()).toMatchObject({
			stats: STATS,
			statsVisible: true,
		})
		expect(change).toHaveBeenCalled()
		expect(labels()).toEqual(['24% clicked'])

		receive(fromEditor('stats', { stats: STATS, visible: false }))
		expect(bridge.getState().statsVisible).toBe(false)
		expect(labels()).toEqual([])

		bridge.destroy()
		expect(overlay()).toBeNull()
	})

	it('shows rates from an editor that sends no switch', () => {
		const { win, receive } = frame()
		const bridge = createBridge(win, CMS)
		receive(fromEditor('stats', { stats: STATS }))
		expect(bridge.getState().statsVisible).toBe(true)
		bridge.destroy()
	})

	it('adds nothing to a page without rates', () => {
		const { win, receive } = frame()
		const bridge = createBridge(win, CMS)
		receive(fromEditor('stats', { stats: {}, visible: true }))
		expect(overlay()).toBeNull()
		bridge.destroy()
	})

	it('selects a block from its label', () => {
		const { win, parent, receive } = frame()
		const bridge = createBridge(win, CMS)
		receive(fromEditor('stats', { stats: STATS, visible: true }))
		;(overlay()!.shadowRoot!.querySelector('.badge') as HTMLElement).click()
		expect(parent.postMessage).toHaveBeenCalledWith(
			{ source: 'obelism-content-bridge', type: 'select', uid: 'b_1' },
			CMS,
		)
		bridge.destroy()
	})

	it('keeps only well-formed rates', () => {
		expect(
			readStats({
				b_1: STATS.b_1,
				b_2: { clicks: '3', clickers: 1, viewers: 1, rate: 1 },
				b_3: null,
			}),
		).toEqual(STATS)
		expect(readStats('nope')).toEqual({})
		expect(readStats([STATS])).toEqual({})
	})
})
