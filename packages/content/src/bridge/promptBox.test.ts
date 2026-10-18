// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type BridgeState, createEmitter, INITIAL_STATE } from './createBridge'
import { jsonErrorAt, mountPromptBox } from './promptBox'

const PAGES = [
	{
		entryId: 'entry_1',
		name: 'Home',
		contentType: 'page',
		status: 'published' as const,
		path: '',
		url: '/',
	},
	{
		entryId: 'entry_2',
		name: 'Pricing',
		contentType: 'page',
		status: 'changed' as const,
		path: 'pricing',
		url: '/pricing',
	},
	{
		entryId: 'entry_3',
		name: 'Agencies',
		contentType: 'page',
		status: 'draft' as const,
		path: 'solutions/agencies',
		url: '/solutions/agencies',
	},
]

// A bridge whose state and answers the test controls.
const fakeBridge = (mode: 'editor' | 'site' = 'editor') => {
	const emitter = createEmitter()
	let state: BridgeState = INITIAL_STATE
	let answer: (value: { summary: string } | Error) => void = () => {}
	const bridge = {
		isEditing: true,
		mode,
		entryId: 'entry_1',
		environment: 'develop',
		on: emitter.on,
		getState: () => state,
		prompt: vi.fn(
			() =>
				new Promise<{ summary: string }>((resolve, reject) => {
					setState({ prompting: true })
					answer = (value) => {
						setState({ prompting: false })
						if (value instanceof Error) reject(value)
						else resolve(value)
					}
				}),
		),
		createPage: vi.fn(async () => {
			setState({ prompting: true })
			await Promise.resolve()
			setState({ prompting: false })
			return {
				summary: 'A page',
				entryId: 'entry_new',
				path: 'pricing',
				url: '/pricing',
			}
		}),
		view: vi.fn(async ({ uid }: { uid?: string | null | undefined } = {}) =>
			uid ? { heading: 'Hi', _uid: uid, _type: 'hero' } : { title: 'Home' },
		),
		applyJson: vi.fn(async (_changes: Record<string, unknown>) => ({
			changed: ['title'],
		})),
		pages: vi.fn(async () => PAGES),
		openPage: vi.fn(),
		undo: vi.fn(),
		save: vi.fn(async () => {}),
		publish: vi.fn(async () => {
			throw new Error('title: Required')
		}),
		signOut: vi.fn(),
		select: vi.fn(),
		setSelecting: vi.fn(),
		destroy: () => {},
	}
	const setState = (next: Partial<BridgeState>) => {
		state = { ...state, ...next }
		emitter.emit('change', state)
	}
	return {
		bridge,
		setState,
		answer: (value: { summary: string } | Error) => answer(value),
	}
}

const shadow = () =>
	document.querySelector('[data-obelism-content-prompt]')!.shadowRoot!
const $ = <T extends Element>(selector: string) =>
	shadow().querySelector<T>(selector)!

let unmount = () => {}
afterEach(() => unmount())

describe('mountPromptBox', () => {
	it('stays hidden until the editor offers prompts', () => {
		const { bridge, setState } = fakeBridge()
		unmount = mountPromptBox(document, bridge)
		expect($<HTMLElement>('.root').hidden).toBe(true)

		setState({ features: ['prompt'] })
		expect($<HTMLElement>('.root').hidden).toBe(false)
		expect($('.pill').textContent).toContain('Edit with a prompt')
	})

	it('sends what is typed and shows the summary', async () => {
		const { bridge, setState, answer } = fakeBridge()
		unmount = mountPromptBox(document, bridge, { labels: { send: 'Go' } })
		setState({ features: ['prompt'] })
		$<HTMLButtonElement>('.pill').click()

		const input = $<HTMLTextAreaElement>('textarea')
		input.value = 'Make it friendlier'
		input.dispatchEvent(new Event('input'))
		expect($<HTMLButtonElement>('.primary').textContent).toBe('Go')
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

		expect(bridge.prompt).toHaveBeenCalledWith('Make it friendlier')
		expect($('.status').textContent).toBe('Working on it…')
		expect(input.disabled).toBe(true)

		answer({ summary: 'Made the copy friendlier' })
		await vi.waitFor(() =>
			expect($('.status').textContent).toBe('Made the copy friendlier'),
		)
		expect(input.value).toBe('')
	})

	it('shows errors, the scope, and offers undo', async () => {
		const { bridge, setState, answer } = fakeBridge()
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt'], selectedUid: 'b_1', canUndo: true })
		$<HTMLButtonElement>('.pill').click()

		expect($('.scope').textContent).toContain('Selected block')
		$<HTMLButtonElement>('.scope button').click()
		expect(bridge.select).toHaveBeenCalledWith(null)

		$<HTMLButtonElement>('.action:not(.primary)').click()
		expect(bridge.undo).toHaveBeenCalled()

		const input = $<HTMLTextAreaElement>('textarea')
		input.value = 'x'
		$<HTMLFormElement>('form').dispatchEvent(new Event('submit'))
		answer(new Error('No rights'))
		await vi.waitFor(() => expect($('.status').textContent).toBe('No rights'))
		expect($('.status').className).toContain('error')
	})

	it('removes itself', () => {
		const { bridge } = fakeBridge()
		mountPromptBox(document, bridge)()
		expect(document.querySelector('[data-obelism-content-prompt]')).toBeNull()
	})

	it('leaves saving and publishing to the visual editor', () => {
		const { bridge, setState } = fakeBridge()
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt'] })
		$<HTMLButtonElement>('.pill').click()
		const buttons = [...shadow().querySelectorAll('button')]
		const visible = buttons
			.filter((button) => !button.closest('[hidden]'))
			.map((button) => button.textContent)
		expect(visible).not.toContain('Save')
		expect(visible).not.toContain('Exit editing')
	})

	it('saves, publishes and signs out on the site', async () => {
		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt', 'save', 'publish'] })
		$<HTMLButtonElement>('.pill').click()
		expect(bridge.setSelecting).toHaveBeenCalledWith(true)

		const button = (text: string) =>
			[...shadow().querySelectorAll('button')].find(
				(button) => button.textContent === text,
			)!
		expect(button('Save').disabled).toBe(true)
		setState({ unsaved: true })
		expect(button('Save').disabled).toBe(false)
		expect($<HTMLElement>('.dot').parentElement!.hidden).toBe(false)

		button('Save').click()
		await vi.waitFor(() =>
			expect($('.status').textContent).toBe('Saved as a draft'),
		)
		button('Publish').click()
		await vi.waitFor(() =>
			expect($('.status').textContent).toBe('title: Required'),
		)
		expect($('.status').className).toContain('error')

		button('Exit editing').click()
		expect(bridge.signOut).toHaveBeenCalled()
	})

	it('makes a new page on the site, from a path and a prompt', async () => {
		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt', 'save', 'publish'] })
		$<HTMLButtonElement>('.pill').click()
		const button = (text: string) =>
			[...shadow().querySelectorAll('button')].find(
				(button) => button.textContent === text,
			)!
		expect(button('New page').hidden).toBe(true)

		setState({ features: ['prompt', 'create', 'save', 'publish'] })
		expect(button('New page').hidden).toBe(false)
		button('New page').click()
		expect(bridge.select).toHaveBeenCalledWith(null)
		expect(bridge.setSelecting).toHaveBeenLastCalledWith(false)
		const path = $<HTMLInputElement>('.path input')
		expect(path.closest('[hidden]')).toBeNull()
		expect(shadow().activeElement).toBe(path)

		const input = $<HTMLTextAreaElement>('textarea')
		expect(input.placeholder).toContain('Describe the new page')
		input.value = 'Our prices'
		input.dispatchEvent(new Event('input'))
		expect($<HTMLButtonElement>('.primary').disabled).toBe(true)
		path.value = '/pricing'
		path.dispatchEvent(new Event('input'))
		expect($<HTMLButtonElement>('.primary').disabled).toBe(false)

		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
		expect(bridge.createPage).toHaveBeenCalledWith('/pricing', 'Our prices')
		expect(bridge.prompt).not.toHaveBeenCalled()
		await vi.waitFor(() =>
			expect($('.status').textContent).toBe('Opening the new page…'),
		)

		$<HTMLButtonElement>('.scope:not([hidden]) button').click()
		expect(path.closest('[hidden]')).not.toBeNull()
		expect(bridge.setSelecting).toHaveBeenLastCalledWith(true)
	})

	it('only offers New page on a page that is no entry', () => {
		const { bridge, setState } = fakeBridge('site')
		const pageless = { ...bridge, entryId: null }
		unmount = mountPromptBox(document, pageless)
		setState({ features: ['prompt', 'create', 'save', 'publish'] })
		expect($('.pill').textContent).toContain('New page')
		$<HTMLButtonElement>('.pill').click()

		const path = $<HTMLInputElement>('.path input')
		expect(path.closest('[hidden]')).toBeNull()
		expect(shadow().activeElement).toBe(path)
		expect(bridge.setSelecting).toHaveBeenLastCalledWith(false)
		const visible = [...shadow().querySelectorAll('button')]
			.filter((button) => !button.closest('[hidden]') && !button.hidden)
			.map((button) => button.textContent)
		expect(visible).not.toContain('Save')
		expect(visible).not.toContain('Publish')
		expect(visible).toContain('Exit editing')
		// No way back to editing a page that isn't there.
		expect($<HTMLButtonElement>('.scope:not([hidden]) button').hidden).toBe(
			true,
		)
	})

	it('shows readers on the site that drafts show, and a way out', () => {
		const { bridge } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		expect($<HTMLElement>('.root').hidden).toBe(false)
		expect($<HTMLElement>('button.pill').hidden).toBe(true)
		expect($('span.pill').textContent).toContain('Viewing drafts')
	})

	it('edits the page or the selected block as JSON on the site', async () => {
		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt', 'create', 'save'] })
		$<HTMLButtonElement>('.pill').click()
		const mode = (text: string) =>
			[...shadow().querySelectorAll<HTMLButtonElement>('.modes button')].find(
				(button) => button.textContent === text,
			)!
		expect(mode('Prompt').getAttribute('aria-pressed')).toBe('true')

		mode('JSON').click()
		const code = $<HTMLTextAreaElement>('textarea.code')
		await vi.waitFor(() => expect(code.value).toBe('{\n  "title": "Home"\n}\n'))
		expect(bridge.view).toHaveBeenCalledTimes(1)
		expect(bridge.view).toHaveBeenCalledWith({ uid: null })
		expect(code.hidden).toBe(false)
		expect($<HTMLTextAreaElement>('textarea').hidden).toBe(true)
		expect(code.spellcheck).toBe(false)
		expect(mode('JSON').getAttribute('aria-pressed')).toBe('true')
		// No New page while editing JSON.
		const newPage = [...shadow().querySelectorAll('button')].find(
			(button) => button.textContent === 'New page',
		)!
		expect(newPage.hidden).toBe(true)

		// Enter is a new line; Tab a tab.
		code.value = '{\n  "title": }'
		code.dispatchEvent(new Event('input'))
		code.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
		expect(bridge.applyJson).not.toHaveBeenCalled()
		code.setSelectionRange(1, 1)
		const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
		code.dispatchEvent(tab)
		expect(tab.defaultPrevented).toBe(true)
		expect(code.value).toBe('{\t\n  "title": }')

		code.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }),
		)
		expect($('.status').textContent).toBe('Not valid JSON at line 2, column 12')
		expect($('.status').className).toContain('error')
		expect(code.selectionStart).toBe(14)
		expect(bridge.applyJson).not.toHaveBeenCalled()

		code.value = '[1]'
		$<HTMLFormElement>('form').dispatchEvent(new Event('submit'))
		expect($('.status').textContent).toContain('an object of fields')

		code.value = '{ "title": "Welcome" }'
		code.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }),
		)
		await vi.waitFor(() => expect($('.status').textContent).toBe('Applied'))
		expect(bridge.applyJson).toHaveBeenCalledWith(
			{ title: 'Welcome' },
			{ uid: null },
		)
		// What the CMS made of it.
		expect(bridge.view).toHaveBeenCalledTimes(2)
		expect(code.value).toBe('{\n  "title": "Home"\n}\n')

		// From the answer, when the CMS sends it: no second request.
		vi.mocked(bridge.applyJson).mockResolvedValueOnce({
			changed: ['title'],
			view: { title: 'Welcome!' },
		})
		code.value = '{ "title": "Welcome!" }'
		$<HTMLFormElement>('form').dispatchEvent(new Event('submit'))
		await vi.waitFor(() =>
			expect(code.value).toBe('{\n  "title": "Welcome!"\n}\n'),
		)
		expect(bridge.view).toHaveBeenCalledTimes(2)

		// A new selection loads its JSON, unless the text was edited.
		setState({ selectedUid: 'b_1' })
		await vi.waitFor(() => expect(code.value).toContain('"_uid": "b_1"'))
		expect(bridge.view).toHaveBeenLastCalledWith({ uid: 'b_1' })
		expect($('.scope').textContent).toContain('Selected block')

		code.value = '{ "heading": "Edited" }'
		code.dispatchEvent(new Event('input'))
		setState({ selectedUid: null })
		await vi.waitFor(() =>
			expect($('.status').textContent).toContain('Kept your unapplied JSON'),
		)
		expect(bridge.view).toHaveBeenCalledTimes(3)
		expect(code.value).toBe('{ "heading": "Edited" }')
		// Still the block's JSON, so applied to the block.
		expect($('.scope').textContent).toContain('Selected block')
		code.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }),
		)
		await vi.waitFor(() =>
			expect(bridge.applyJson).toHaveBeenLastCalledWith(
				{ heading: 'Edited' },
				{ uid: 'b_1' },
			),
		)

		$<HTMLButtonElement>('button[aria-label="Reload the JSON"]').click()
		await vi.waitFor(() => expect(code.value).toBe('{\n  "title": "Home"\n}\n'))

		mode('Prompt').click()
		expect(code.hidden).toBe(true)
		expect($<HTMLTextAreaElement>('textarea').hidden).toBe(false)
	})

	it('offers JSON only on the site, and not for a new page', () => {
		const editor = fakeBridge()
		unmount = mountPromptBox(document, editor.bridge)
		editor.setState({ features: ['prompt'] })
		$<HTMLButtonElement>('.pill').click()
		expect($<HTMLElement>('.modes').hidden).toBe(true)
		unmount()

		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt', 'create'] })
		$<HTMLButtonElement>('.pill').click()
		expect($<HTMLElement>('.modes').hidden).toBe(false)
		;[...shadow().querySelectorAll('button')]
			.find((button) => button.textContent === 'New page')!
			.click()
		expect($<HTMLElement>('.modes').hidden).toBe(true)
	})

	it('goes to another page of the site', async () => {
		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt', 'save'] })
		$<HTMLButtonElement>('.pill').click()
		const chip = $<HTMLButtonElement>('.page-chip')
		await vi.waitFor(() => expect(chip.textContent).toBe('Home'))
		expect(bridge.pages).toHaveBeenCalledTimes(1)
		expect(chip.getAttribute('aria-expanded')).toBe('false')

		chip.click()
		expect(chip.getAttribute('aria-expanded')).toBe('true')
		const search = $<HTMLInputElement>('.search input')
		expect(shadow().activeElement).toBe(search)
		expect($<HTMLElement>('.toolbar').hidden).toBe(true)
		const options = () => [
			...shadow().querySelectorAll<HTMLElement>('[role="option"]'),
		]
		expect(options().map((option) => option.textContent)).toEqual([
			'Home/',
			'Pricing/pricingChanged',
			'Agencies/solutions/agenciesDraft',
		])
		expect(options()[0]!.getAttribute('aria-current')).toBe('page')
		expect(options()[0]!.getAttribute('aria-selected')).toBe('true')

		search.value = 'solu'
		search.dispatchEvent(new Event('input'))
		expect(options()).toHaveLength(1)
		search.value = 'nothing like it'
		search.dispatchEvent(new Event('input'))
		expect(options()).toHaveLength(0)
		expect($('.empty').textContent).toBe('No pages match')

		search.value = ''
		search.dispatchEvent(new Event('input'))
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
		expect(options()[1]!.getAttribute('aria-selected')).toBe('true')
		expect(search.getAttribute('aria-activedescendant')).toBe(options()[1]!.id)
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
		expect(bridge.openPage).toHaveBeenCalledWith(PAGES[1])

		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
		expect(chip.getAttribute('aria-expanded')).toBe('false')
		expect($<HTMLElement>('.pages').hidden).toBe(true)
		expect(shadow().activeElement).toBe(chip)

		// Fetched once.
		chip.click()
		options()[2]!.click()
		expect(bridge.openPage).toHaveBeenLastCalledWith(PAGES[2])
		expect(bridge.pages).toHaveBeenCalledTimes(1)
	})

	it('goes to a page from a page that is no entry', async () => {
		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, { ...bridge, entryId: null })
		setState({ features: ['prompt', 'create'] })
		$<HTMLButtonElement>('.pill').click()
		const chip = $<HTMLButtonElement>('.page-chip')
		expect(chip.hidden).toBe(false)
		await vi.waitFor(() => expect(bridge.pages).toHaveBeenCalled())
		expect(chip.textContent).toBe('Pages')
		chip.click()
		expect(shadow().querySelectorAll('[role="option"]')).toHaveLength(3)
	})
})

describe('jsonErrorAt', () => {
	it('finds where text stops being JSON', () => {
		expect(jsonErrorAt('{ "a": [1, -2.5e3, true, null, "\\u00e9"] }')).toBe(-1)
		expect(jsonErrorAt('{ "a": }')).toBe(7)
		expect(jsonErrorAt('[1, 2,]')).toBe(6)
		expect(jsonErrorAt('{ "a": 1 } x')).toBe(11)
		expect(jsonErrorAt('"\\q"')).toBe(2)
		expect(jsonErrorAt('')).toBe(0)
	})
})
