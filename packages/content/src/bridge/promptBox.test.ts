// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	type ApplyJsonResult,
	type BridgeState,
	createEmitter,
	type FormHandle,
	type FormOptions,
	INITIAL_STATE,
} from './createBridge'
import { mountPromptBox } from './promptBox'

const PAGES = [
	{
		entryId: 'entry_1',
		name: 'Home',
		contentType: 'page',
		status: 'published' as const,
		path: '',
		url: '/',
		product: null,
	},
	{
		entryId: 'entry_2',
		name: 'Pricing',
		contentType: 'page',
		status: 'changed' as const,
		path: 'pricing',
		url: '/pricing',
		product: null,
	},
	{
		entryId: 'entry_3',
		name: 'Agencies',
		contentType: 'page',
		status: 'draft' as const,
		path: 'solutions/agencies',
		url: '/solutions/agencies',
		product: null,
	},
]

// A bridge whose state and answers the test controls.
const fakeBridge = (mode: 'editor' | 'site' = 'editor') => {
	const emitter = createEmitter()
	let state: BridgeState = INITIAL_STATE
	let answer: (value: { summary: string } | Error) => void = () => {}
	// The forms opened, newest last.
	const forms: { frame: HTMLIFrameElement; options: FormOptions }[] = []
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
		product: null as { id: string; handle: string } | null,
		createProductPage: vi.fn(async () => {
			setState({ prompting: true })
			await Promise.resolve()
			setState({ prompting: false })
			return { entryId: 'entry_mug', path: 'products/mug', created: true }
		}),
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
		applyJson: vi.fn(
			async (_changes: Record<string, unknown>): Promise<ApplyJsonResult> => ({
				changed: ['title'],
			}),
		),
		openForm: vi.fn(
			(container: HTMLElement, options: FormOptions = {}): FormHandle => {
				const frame = document.createElement('iframe')
				frame.title = options.title ?? ''
				container.appendChild(frame)
				forms.push({ frame, options })
				return { close: () => frame.remove() }
			},
		),
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
		forms,
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

	it('offers a product page on a product without one', async () => {
		const { bridge, setState } = fakeBridge('site')
		const product = {
			...bridge,
			entryId: null,
			product: { id: 'gid://shopify/Product/42', handle: 'mug' },
		}
		unmount = mountPromptBox(document, product)
		setState({ features: ['prompt', 'create', 'save', 'publish'] })
		expect($('.pill').textContent).toContain('Add a product page')
		$<HTMLButtonElement>('.pill').click()
		expect($<HTMLTextAreaElement>('textarea').hidden).toBe(true)
		expect($('.status').textContent).toContain('This product has no page yet')

		const add = [...shadow().querySelectorAll('.toolbar button')].find(
			(button) => button.textContent === 'Add a product page',
		) as HTMLButtonElement
		expect(add.hidden).toBe(false)
		add.click()
		expect(bridge.createProductPage).toHaveBeenCalled()
		await vi.waitFor(() =>
			expect($('.status').textContent).toBe('Opening the product page…'),
		)

		// New page is still there, for a page written from a prompt.
		const newPage = [...shadow().querySelectorAll('button')].find(
			(button) => button.textContent === 'New page',
		)!
		newPage.click()
		expect(add.hidden).toBe(true)
		expect($<HTMLTextAreaElement>('textarea').hidden).toBe(false)
	})

	it('shows readers on the site that drafts show, and a way out', () => {
		const { bridge } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		expect($<HTMLElement>('.root').hidden).toBe(false)
		expect($<HTMLElement>('button.pill').hidden).toBe(true)
		expect($('span.pill').textContent).toContain('Viewing drafts')
	})

	it('edits the page in the CMS’s form on the site', () => {
		const { bridge, setState, forms } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt', 'create', 'save', 'publish'] })
		$<HTMLButtonElement>('.pill').click()
		const mode = (text: string) =>
			[...shadow().querySelectorAll<HTMLButtonElement>('.modes button')].find(
				(button) => button.textContent === text,
			)!
		const visible = () =>
			[...shadow().querySelectorAll('button')]
				.filter((button) => !button.closest('[hidden]') && !button.hidden)
				.map((button) => button.textContent)
		expect(mode('Prompt').getAttribute('aria-pressed')).toBe('true')
		expect(bridge.openForm).not.toHaveBeenCalled()

		mode('Form').click()
		expect(mode('Form').getAttribute('aria-pressed')).toBe('true')
		expect(bridge.openForm).toHaveBeenCalledTimes(1)
		const form = $<HTMLElement>('.form')
		expect(form.hidden).toBe(false)
		expect(form.querySelector('iframe')!.title).toBe('The content form')
		expect($<HTMLTextAreaElement>('textarea').hidden).toBe(true)
		expect($('.status').textContent).toBe('Opening the form…')
		expect($('.status').className).toContain('working')
		expect(form.className).toContain('loading')
		// Edits apply live: no Apply, and no New page; the footer stays.
		expect($<HTMLButtonElement>('.primary').hidden).toBe(true)
		expect(visible()).not.toContain('New page')
		expect(visible()).toEqual(
			expect.arrayContaining(['Save', 'Publish', 'Exit editing']),
		)

		forms[0]!.options.onReady!()
		expect(form.className).not.toContain('loading')
		expect($('.status').textContent).toBe(
			'Click a block to change only that block',
		)
		setState({ canUndo: true, selectedUid: 'b_1' })
		expect(visible()).toContain('Undo')
		expect($('.scope').textContent).toContain('Selected block')

		forms[0]!.options.onError!('The form failed to load')
		expect($('.status').textContent).toBe('The form failed to load')
		expect($('.status').className).toContain('error')

		// Back to Prompt: the form goes, and a fresh one comes next time.
		mode('Prompt').click()
		expect(form.querySelector('iframe')).toBeNull()
		expect($<HTMLTextAreaElement>('textarea').hidden).toBe(false)
		expect($<HTMLButtonElement>('.primary').hidden).toBe(false)
		mode('Form').click()
		expect(bridge.openForm).toHaveBeenCalledTimes(2)
		// A late answer from the first form changes nothing.
		forms[0]!.options.onReady!()
		expect($('.status').textContent).toBe('Opening the form…')

		// Closing the box removes it too; opening it shows a fresh one.
		$<HTMLButtonElement>('.close').click()
		expect(form.querySelector('iframe')).toBeNull()
		$<HTMLButtonElement>('.pill').click()
		expect(bridge.openForm).toHaveBeenCalledTimes(3)
		expect(form.querySelectorAll('iframe')).toHaveLength(1)

		// Not for a new page.
		mode('Prompt').click()
		;[...shadow().querySelectorAll('button')]
			.find((button) => button.textContent === 'New page')!
			.click()
		expect($<HTMLElement>('.modes').hidden).toBe(true)
		expect(form.querySelector('iframe')).toBeNull()

		unmount()
		expect(bridge.openForm).toHaveBeenCalledTimes(3)
	})

	it('minimizes to show the page, keeping the form', () => {
		const { bridge, setState, forms } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt', 'form', 'save', 'publish'] })
		$<HTMLButtonElement>('.pill').click()
		const toggle = $<HTMLButtonElement>(
			'[aria-label="Minimize, to see the page"]',
		)
		expect(toggle.getAttribute('aria-expanded')).toBe('true')

		// In Prompt mode: the prompt and the status go, the bar stays.
		toggle.click()
		expect($<HTMLTextAreaElement>('textarea').hidden).toBe(true)
		expect($<HTMLElement>('.status').hidden).toBe(true)
		expect($<HTMLButtonElement>('.primary').hidden).toBe(true)
		expect($<HTMLElement>('.toolbar').hidden).toBe(false)
		expect($<HTMLElement>('.footer').hidden).toBe(false)
		expect(toggle.getAttribute('aria-label')).toBe('Expand')
		expect(toggle.getAttribute('aria-expanded')).toBe('false')
		toggle.click()
		expect($<HTMLTextAreaElement>('textarea').hidden).toBe(false)

		// In Form mode the form stays loaded while minimized.
		$<HTMLButtonElement>('.modes button:last-child').click()
		forms[0]!.options.onReady!()
		const frame = $('.form iframe')
		toggle.click()
		expect($<HTMLElement>('.form').hidden).toBe(true)
		expect(frame.isConnected).toBe(true)
		toggle.click()
		expect($<HTMLElement>('.form').hidden).toBe(false)
		expect($('.form iframe')).toBe(frame)
		expect(bridge.openForm).toHaveBeenCalledTimes(1)

		// Closing forgets it: the box opens expanded.
		toggle.click()
		$<HTMLButtonElement>('.close').click()
		$<HTMLButtonElement>('.pill').click()
		expect($<HTMLElement>('.form').hidden).toBe(false)
		expect(toggle.getAttribute('aria-label')).toBe('Minimize, to see the page')
	})

	it('expands when another button is clicked while minimized', () => {
		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt', 'create', 'save', 'publish'] })
		$<HTMLButtonElement>('.pill').click()
		const toggle = $<HTMLButtonElement>(
			'[aria-label="Minimize, to see the page"]',
		)
		toggle.click()
		expect($<HTMLTextAreaElement>('textarea').hidden).toBe(true)

		// The pages open, in place of the toolbar.
		$<HTMLButtonElement>('.page-chip').click()
		expect(toggle.getAttribute('aria-expanded')).toBe('true')
		expect($<HTMLElement>('.pages').hidden).toBe(false)

		// Closing still closes.
		$<HTMLButtonElement>('.page-chip').click()
		toggle.click()
		$<HTMLButtonElement>('.close').click()
		expect($<HTMLElement>('.panel').hidden).toBe(true)
	})

	it('moves to a side of the screen when dragged, and stays there', () => {
		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt'] })
		const root = $<HTMLElement>('.root')
		const pill = $<HTMLButtonElement>('.pill')
		const pointer = (type: string, target: Element, clientX: number) =>
			target.dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					composed: true,
					isPrimary: true,
					pointerId: 1,
					button: 0,
					clientX,
				}),
			)
		const width = window.innerWidth

		// A drag from the pill to the right third: not a click on it.
		pointer('pointerdown', pill, width / 2)
		pointer('pointermove', pill, width - 40)
		expect(root.classList.contains('dragging')).toBe(true)
		pointer('pointerup', pill, width - 40)
		pill.click()
		expect(root.dataset.side).toBe('right')
		expect(root.classList.contains('dragging')).toBe(false)
		expect($<HTMLElement>('.panel').hidden).toBe(true)

		// A wobble is still a click.
		pointer('pointerdown', pill, 100)
		pointer('pointermove', pill, 103)
		pointer('pointerup', pill, 103)
		pill.click()
		expect($<HTMLElement>('.panel').hidden).toBe(false)

		// Not from the prompt; from the toolbar, back to the middle.
		const textarea = $<HTMLTextAreaElement>('textarea')
		pointer('pointerdown', textarea, width - 40)
		pointer('pointermove', textarea, width / 2)
		pointer('pointerup', textarea, width / 2)
		expect(root.dataset.side).toBe('right')
		const toolbar = $<HTMLElement>('.toolbar')
		pointer('pointerdown', toolbar, width - 40)
		pointer('pointermove', toolbar, width / 2)
		pointer('pointerup', toolbar, width / 2)
		expect(root.dataset.side).toBeUndefined()

		// The left, remembered next time.
		pointer('pointerdown', toolbar, width / 2)
		pointer('pointermove', toolbar, 20)
		pointer('pointerup', toolbar, 20)
		unmount()
		unmount = mountPromptBox(document, bridge)
		expect($<HTMLElement>('.root').dataset.side).toBe('left')
		localStorage.clear()
	})

	it('removes the form with the box', () => {
		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		setState({ features: ['prompt'] })
		$<HTMLButtonElement>('.pill').click()
		$<HTMLButtonElement>('.modes button:last-child').click()
		const frame = $('.form iframe')
		unmount()
		expect(frame.isConnected).toBe(false)
	})

	it('offers the form only on the site, and not for a new page', () => {
		const editor = fakeBridge()
		unmount = mountPromptBox(document, editor.bridge)
		editor.setState({ features: ['prompt'] })
		$<HTMLButtonElement>('.pill').click()
		expect($<HTMLElement>('.modes').hidden).toBe(true)
		unmount()

		const { bridge, setState } = fakeBridge('site')
		unmount = mountPromptBox(document, bridge)
		// A CMS from before the form.
		setState({ features: ['prompt', 'create'] })
		$<HTMLButtonElement>('.pill').click()
		expect($<HTMLElement>('.modes').hidden).toBe(true)
		setState({ features: ['prompt', 'form', 'create'] })
		expect($<HTMLElement>('.modes').hidden).toBe(false)
		expect($('.modes').textContent).toBe('PromptForm')
		;[...shadow().querySelectorAll('button')]
			.find((button) => button.textContent === 'New page')!
			.click()
		expect($<HTMLElement>('.modes').hidden).toBe(true)
		unmount()

		const pageless = fakeBridge('site')
		unmount = mountPromptBox(document, { ...pageless.bridge, entryId: null })
		pageless.setState({ features: ['prompt', 'save'] })
		$<HTMLButtonElement>('.pill').click()
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
