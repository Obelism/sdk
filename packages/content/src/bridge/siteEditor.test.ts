// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	type BridgeState,
	createEmitter,
	type FormOptions,
	INITIAL_STATE,
} from './createBridge'
import { diffViews, humanize, mountSiteEditor } from './siteEditor'

const PAGES = [
	{
		entryId: 'entry_1',
		name: 'Home',
		contentType: 'page',
		status: 'published' as const,
		path: '',
		url: '/',
		product: null,
		collection: null,
	},
	{
		entryId: 'entry_2',
		name: 'Pricing',
		contentType: 'page',
		status: 'draft' as const,
		path: 'pricing',
		url: '/pricing',
		product: null,
		collection: null,
	},
]

// A site bridge whose state and answers the test controls. The hero's title
// is what prompts change.
const fakeBridge = () => {
	const emitter = createEmitter()
	let state: BridgeState = INITIAL_STATE
	let title = 'We build brands'
	const history: string[] = []
	let answer: (value: { summary: string } | Error) => void = () => {}
	const forms: { frame: HTMLIFrameElement; options: FormOptions }[] = []
	const setState = (next: Partial<BridgeState>) => {
		state = { ...state, ...next }
		emitter.emit('change', state)
	}
	const bridge = {
		isEditing: true,
		mode: 'site' as const,
		entryId: 'entry_1' as string | null,
		environment: 'develop' as string | null,
		product: null as { id: string; handle: string } | null,
		collection: null as { id: string; handle: string } | null,
		on: emitter.on,
		getState: () => state,
		prompt: vi.fn(
			(_text: string, _options?: { uid?: string | null }) =>
				new Promise<{ summary: string }>((resolve, reject) => {
					setState({ prompting: true })
					answer = (value) => {
						if (!(value instanceof Error)) {
							history.push(title)
							title = 'We build flagship stores'
						}
						setState({
							prompting: false,
							unsaved: history.length > 0,
							canUndo: history.length > 0,
							undoSteps: history.length,
						})
						if (value instanceof Error) reject(value)
						else resolve(value)
					}
				}),
		),
		view: vi.fn(async ({ uid }: { uid?: string | null | undefined } = {}) =>
			uid === 'hero_1'
				? { _uid: 'hero_1', _type: 'heroTitle', heading: title }
				: {
						title: 'Home',
						blocks: [{ _uid: 'hero_1', _type: 'heroTitle', heading: title }],
					},
		),
		applyJson: vi.fn(async () => ({ changed: [] })),
		createPage: vi.fn(async () => ({
			summary: 'A page',
			entryId: 'entry_new',
			path: 'pricing',
			url: '/pricing',
		})),
		createProductPage: vi.fn(async () => ({
			entryId: 'entry_mug',
			path: 'products/mug',
			created: true,
		})),
		createCollectionPage: vi.fn(async () => ({
			entryId: 'entry_sale',
			path: 'collections/sale',
			created: true,
		})),
		openForm: vi.fn((container: HTMLElement, options: FormOptions = {}) => {
			const frame = document.createElement('iframe')
			container.appendChild(frame)
			forms.push({ frame, options })
			return { close: () => frame.remove() }
		}),
		pages: vi.fn(async () => PAGES),
		openPage: vi.fn(),
		undo: vi.fn(() => {
			const last = history.pop()
			if (last !== undefined) title = last
			setState({
				unsaved: history.length > 0,
				canUndo: history.length > 0,
				undoSteps: history.length,
			})
		}),
		save: vi.fn(async () => setState({ unsaved: false })),
		publish: vi.fn(async () => {
			throw new Error('title: Required')
		}),
		signOut: vi.fn(),
		select: vi.fn((uid: string | null) => setState({ selectedUid: uid })),
		setSelecting: vi.fn((selecting: boolean) => setState({ selecting })),
		destroy: () => {},
	}
	return {
		bridge,
		setState,
		forms,
		answer: (value: { summary: string } | Error) => answer(value),
	}
}

const shadow = () =>
	document.querySelector('[data-obelism-content-editor]')!.shadowRoot!
const $ = <T extends Element = HTMLElement>(selector: string) =>
	shadow().querySelector<T>(selector)!
const button = (text: string, scope = '') =>
	[...shadow().querySelectorAll<HTMLButtonElement>(`${scope} button`)].find(
		(node) => node.textContent?.trim() === text,
	)!
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const type = (text: string) => {
	const input = $<HTMLTextAreaElement>('textarea')
	input.value = text
	input.dispatchEvent(new Event('input'))
	input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
}

let unmount = () => {}
beforeEach(() => {
	localStorage.clear()
	document.body.innerHTML =
		'<main data-cms-entry="entry_1"><h1 data-cms-uid="hero_1">We build brands</h1></main>'
})
afterEach(() => unmount())

describe('humanize', () => {
	it('names block types after their apiIds', () => {
		expect(humanize('heroTitle')).toBe('Hero title')
		expect(humanize('call_to-action')).toBe('Call to action')
	})
})

describe('diffViews', () => {
	it('lists the texts that changed, following blocks by uid', () => {
		expect(
			diffViews(
				{
					title: 'Home',
					blocks: [
						{ _uid: 'a', _type: 'hero', heading: 'Hi' },
						{ _uid: 'b', _type: 'quote', text: 'Old' },
					],
				},
				{
					title: 'Home',
					blocks: [
						{ _uid: 'b', _type: 'quote', text: 'Old' },
						{ _uid: 'a', _type: 'hero', heading: 'Hello' },
						{ _uid: 'c', _type: 'quote', text: 'New' },
					],
				},
			),
		).toEqual([
			{ label: 'Hero · Heading', before: 'Hi', after: 'Hello' },
			{ label: 'Quote · Text', before: '', after: 'New' },
		])
	})
})

describe('mountSiteEditor', () => {
	it('docks beside the site once prompts are offered', () => {
		const { bridge, setState } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		expect($('.panel').hasAttribute('data-closed')).toBe(true)
		expect(document.documentElement.hasAttribute('data-obelism-docked')).toBe(
			false,
		)

		setState({ features: ['prompt', 'save', 'publish', 'form'] })
		expect($('.panel').hasAttribute('data-closed')).toBe(false)
		expect($('.panel').getAttribute('aria-label')).toBe('Obelism editor')
		expect(document.documentElement.hasAttribute('data-obelism-docked')).toBe(
			true,
		)
		expect(bridge.setSelecting).toHaveBeenLastCalledWith(true)
		expect($('.env').textContent).toBe('Environment: develop')
		expect($('.launch').textContent).toBe('Editing')
	})

	it('minimises to the launcher and back, minding focus', () => {
		const { bridge, setState } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })

		$<HTMLButtonElement>('.head .icon-button').click()
		expect($('.panel').hasAttribute('data-closed')).toBe(true)
		expect(document.documentElement.hasAttribute('data-obelism-docked')).toBe(
			false,
		)
		expect(shadow().activeElement).toBe($('.launch'))
		expect($('.launch').getAttribute('aria-expanded')).toBe('false')
		expect(bridge.setSelecting).toHaveBeenLastCalledWith(false)
		expect(localStorage.getItem('obelism-content-editor')).toBe('minimised')

		$<HTMLButtonElement>('.launch').click()
		expect($('.panel').hasAttribute('data-closed')).toBe(false)
		expect(shadow().activeElement).toBe($('textarea'))
	})

	it('stays minimised on the next page when left so', () => {
		localStorage.setItem('obelism-content-editor', 'minimised')
		const { bridge, setState } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		expect($('.panel').hasAttribute('data-closed')).toBe(true)
	})

	it('shows readers that drafts show, and a way out', () => {
		const { bridge } = fakeBridge()
		unmount = mountSiteEditor(document, bridge, {
			labels: { signOut: 'Stop' },
		})
		expect($('.reading').hidden).toBe(false)
		expect($('.launch').hidden).toBe(true)
		button('Stop').click()
		expect(bridge.signOut).toHaveBeenCalled()
	})

	it('names the block it works on, and steps back with Escape', async () => {
		const { bridge, setState } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		await settle()
		expect($('.note').textContent).toContain('Working on the whole page')

		bridge.select('hero_1')
		expect($('.note').textContent).toContain(
			'Working on Hero title. Click another block to switch.',
		)
		expect($('.note strong').textContent).toBe('Hero title')

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
		expect(bridge.select).toHaveBeenLastCalledWith(null)
		expect($('.note').textContent).toContain('Working on the whole page')
	})

	it('previews an answer with what changed, saved only once kept', async () => {
		const { bridge, setState, answer } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt', 'save', 'publish'] })
		bridge.select('hero_1')

		type('Make it warmer')
		expect($('.bubble').textContent).toContain('Make it warmer')
		await vi.waitFor(() =>
			expect(bridge.prompt).toHaveBeenCalledWith('Make it warmer', {
				uid: 'hero_1',
			}),
		)
		expect($('.answer').textContent).toContain('Working on it…')

		answer({ summary: 'A warmer title.' })
		await vi.waitFor(() => expect($('.answer').dataset.status).toBe('pending'))
		expect($('.answer .eyebrow').textContent).toBe('Suggested by Obelism')
		expect($('.answer .summary').textContent).toBe('A warmer title.')
		expect($('.diff-label').textContent).toBe('Heading')
		expect($('.before .value').textContent).toBe('We build brands')
		expect($('.after .value').textContent).toBe('We build flagship stores')
		expect(button('Save draft').disabled).toBe(true)
		expect(button('Publish').disabled).toBe(true)
		expect($('.save-state').textContent).toBe(
			'Keep or undo the suggestion to save',
		)

		const summary = $('.answer .summary')
		button('Keep it', '.answer').click()
		expect($('.answer').dataset.status).toBe('kept')
		expect($('.answer .eyebrow').textContent).toBe('Kept')
		expect($('.answer .actions').hidden).toBe(true)
		// Updated in place, so the log doesn't read the card out again.
		expect($('.answer .summary')).toBe(summary)
		expect(button('Save draft').disabled).toBe(false)
		expect($('.save-state').textContent).toBe('Unsaved changes')

		// Undo reverts the last kept change, and says so on its card.
		button('Undo', '.foot').click()
		expect(bridge.undo).toHaveBeenCalledTimes(1)
		expect(bridge.getState().unsaved).toBe(false)
		expect($('.save-state').textContent).toBe('No unsaved changes')
		expect($('.answer').dataset.status).toBe('undone')
		expect($('.answer .eyebrow').textContent).toBe('Undone')
		expect($('.panel > [role="status"]').textContent).toBe(
			'Undone: A warmer title.',
		)
	})

	it('undoes a suggestion, or tries another', async () => {
		const { bridge, setState, answer } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt', 'save'] })

		type('Shorter')
		await vi.waitFor(() => expect(bridge.prompt).toHaveBeenCalledTimes(1))
		answer({ summary: 'Shorter.' })
		await vi.waitFor(() => expect(button('Try another')).toBeDefined())

		button('Try another').click()
		expect(bridge.undo).toHaveBeenCalledTimes(1)
		await vi.waitFor(() => expect(bridge.prompt).toHaveBeenCalledTimes(2))
		expect(bridge.prompt).toHaveBeenLastCalledWith(
			'Shorter\n\nWrite a different version than the last one.',
			{ uid: null },
		)
		answer({ summary: 'Another.' })
		await vi.waitFor(() =>
			expect(
				[...shadow().querySelectorAll<HTMLElement>('.answer')].map(
					(node) => node.dataset.status,
				),
			).toEqual(['undone', 'pending']),
		)

		const undoButtons = [
			...shadow().querySelectorAll<HTMLElement>('.answer .actions'),
		]
			.filter((actions) => !actions.hidden)
			.flatMap((actions) => [...actions.querySelectorAll('button')])
			.filter((node) => node.textContent === 'Undo')
		expect(undoButtons).toHaveLength(1)
		;(undoButtons[0] as HTMLButtonElement).click()
		expect(bridge.undo).toHaveBeenCalledTimes(2)
		expect(
			[...shadow().querySelectorAll<HTMLElement>('.answer')].map(
				(node) => node.dataset.status,
			),
		).toEqual(['undone', 'undone'])
	})

	it('shows a failed prompt as an error', async () => {
		const { bridge, setState, answer } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		type('Do it')
		await vi.waitFor(() => expect(bridge.prompt).toHaveBeenCalled())
		answer(new Error('The model could not'))
		await vi.waitFor(() =>
			expect($('.failure').textContent).toBe('The model could not'),
		)
	})

	it('asks to keep or undo a suggestion before editing fields', async () => {
		const { bridge, setState, answer, forms } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt', 'form', 'save'] })
		// The fields are the first view, and the form is already up.
		expect($('.fields').hidden).toBe(false)
		expect($('.ask').hidden).toBe(true)
		expect(forms).toHaveLength(1)

		button('Ask').click()
		expect($('.fields').hidden).toBe(true)
		expect(forms[0]!.frame.isConnected).toBe(false)

		type('Shorter')
		await vi.waitFor(() => expect(bridge.prompt).toHaveBeenCalled())
		answer({ summary: 'Shorter.' })
		await vi.waitFor(() => expect($('.answer').dataset.status).toBe('pending'))

		// Back to the fields with a suggestion waiting: asked first.
		button('Ask').click()
		expect($('.gate').hidden).toBe(false)
		expect($('.gate').textContent).toContain(
			'Keep or undo the suggestion before editing fields.',
		)
		expect(shadow().activeElement).toBe(button('Keep it', '.gate'))
		expect($('.answer').dataset.status).toBe('pending')
		expect(button('Ask').getAttribute('aria-pressed')).toBe('true')

		button('Undo', '.gate').click()
		expect(bridge.undo).toHaveBeenCalledTimes(1)
		expect($('.answer').dataset.status).toBe('undone')
		expect($('.gate').hidden).toBe(true)
		expect(button('Ask').getAttribute('aria-pressed')).toBe('false')
		expect($('.ask').hidden).toBe(true)
		expect(forms).toHaveLength(2)
		expect(forms[1]!.frame.isConnected).toBe(true)
		expect($('.form-note').textContent).toBe('Opening the form…')
		forms[1]!.options.onReady?.()
		expect($('.form-note').hidden).toBe(true)
	})

	it('switches between the fields and the ask view with the head button', () => {
		const { bridge, setState, forms } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt', 'form'] })
		const ask = $<HTMLButtonElement>('.mode')
		expect(ask.getAttribute('aria-pressed')).toBe('false')
		expect(forms).toHaveLength(1)

		ask.click()
		expect(ask.getAttribute('aria-pressed')).toBe('true')
		expect($('.ask').hidden).toBe(false)
		expect($('.fields').hidden).toBe(true)
		expect(forms[0]!.frame.isConnected).toBe(false)

		ask.click()
		expect(ask.getAttribute('aria-pressed')).toBe('false')
		expect($('.fields').hidden).toBe(false)
		expect(forms).toHaveLength(2)
		expect(forms[1]!.frame.isConnected).toBe(true)
	})

	it('steps back on Escape in the form too', () => {
		const { bridge, setState, forms } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt', 'form'] })
		bridge.select('hero_1')
		forms[0]!.options.onEscape?.()
		expect(bridge.select).toHaveBeenLastCalledWith(null)
	})

	it('offers the whole page above the form as well', async () => {
		const { bridge, setState } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt', 'form'] })
		await settle()
		const back = () => $('.fields .note')
		expect(back().hidden).toBe(true)

		bridge.select('hero_1')
		expect(back().hidden).toBe(false)
		expect(back().textContent).toContain(
			'Working on Hero title. Click another block to switch.',
		)

		button('Whole page', '.fields').click()
		expect(bridge.select).toHaveBeenLastCalledWith(null)
		expect(back().hidden).toBe(true)
	})

	it('washes the previewed block and names its page', async () => {
		document.title = 'Home page'
		const { bridge, setState, answer } = fakeBridge()
		bridge.pages.mockRejectedValue(new Error('No'))
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		const hero = document.querySelector('h1')!
		hero.getBoundingClientRect = () =>
			({
				top: 100,
				left: 40,
				right: 440,
				bottom: 300,
				width: 400,
				height: 200,
			}) as DOMRect
		bridge.select('hero_1')
		type('Warmer')
		await vi.waitFor(() => expect(bridge.prompt).toHaveBeenCalled())
		answer({ summary: 'Warmer.' })
		await vi.waitFor(() => expect($('.wash .box.fill')).not.toBeNull())
		expect($('.layer .accent-chip').textContent).toBe('Hero title · preview')
		expect($('.layer .ink-chip').textContent).toBe('Home page')
	})

	it('tells the site how much room the panel takes', () => {
		document.body.innerHTML +=
			'<header data-obelism-dock style="position: fixed; right: 0">Cart</header>'
		const { bridge, setState } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		const style = document.documentElement.style
		expect(style.getPropertyValue('--obelism-dock')).toBe('436px')
		expect(getComputedStyle(document.querySelector('header')!).right).toBe(
			'436px',
		)
		$<HTMLButtonElement>('.head .icon-button').click()
		expect(style.getPropertyValue('--obelism-dock')).toBe('0px')
		expect(getComputedStyle(document.querySelector('header')!).right).toBe(
			'0px',
		)
	})

	it('goes to another page from the header', async () => {
		const { bridge, setState } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		await vi.waitFor(() =>
			expect($('.page-button').textContent).toContain('Home'),
		)

		$<HTMLButtonElement>('.page-button').click()
		expect($('.pages').hidden).toBe(false)
		expect(shadow().activeElement).toBe($('.search input'))
		expect($('.options').textContent).toContain('Pricing')
		;[...shadow().querySelectorAll<HTMLElement>('.option')][1]!.click()
		expect(bridge.openPage).toHaveBeenCalledWith(PAGES[1])

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
		expect($('.pages').hidden).toBe(true)
	})

	it('names the page when the pages can’t be listed', async () => {
		document.title = 'About us'
		const { bridge, setState } = fakeBridge()
		bridge.pages.mockRejectedValue(new Error('No'))
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		await vi.waitFor(() => expect($('.page-name').hidden).toBe(false))
		expect($('.page-name').textContent).toBe('About us')
		expect($('.page-button').hidden).toBe(true)
	})

	it('says live for production', () => {
		const { bridge, setState } = fakeBridge()
		bridge.environment = 'production'
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		expect($('.env').textContent).toBe('Environment: live')
		expect($('.env').dataset.env).toBe('production')
	})

	it('hides the outlines, and lets the page’s links work meanwhile', () => {
		const { bridge, setState } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		const eye = $<HTMLButtonElement>('.eye')
		expect(eye.getAttribute('aria-pressed')).toBe('false')
		eye.click()
		expect(eye.getAttribute('aria-pressed')).toBe('true')
		expect(bridge.setSelecting).toHaveBeenLastCalledWith(false)
	})

	it('saves and publishes, with the reason when that fails', async () => {
		const { bridge, setState } = fakeBridge()
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt', 'save', 'publish'], unsaved: true })

		button('Save draft').click()
		await vi.waitFor(() => expect(bridge.save).toHaveBeenCalled())
		await vi.waitFor(() =>
			expect($('.save-state').textContent).toBe('Saved as a draft'),
		)

		button('Publish').click()
		await vi.waitFor(() =>
			expect($('.save-state').textContent).toBe(
				'Couldn’t publish: title: RequiredTry again',
			),
		)
		expect($('.save-state').dataset.state).toBe('error')
		button('Try again').click()
		expect(bridge.publish).toHaveBeenCalledTimes(2)
	})

	it('leaves Exit out when asked to, and puts the page’s controls in the footer', () => {
		const { bridge, setState } = fakeBridge()
		const actions = document.createElement('button')
		unmount = mountSiteEditor(document, bridge, { signOut: false, actions })
		setState({ features: ['prompt'] })
		expect($('.exit').hidden).toBe(true)
		expect($('.mode').hidden).toBe(true)
		expect(actions.slot).toBe('actions-footer')
		$<HTMLButtonElement>('.head .icon-button').click()
		expect(actions.slot).toBe('actions-bar')
	})

	it('only offers New page on a page that is no entry', async () => {
		document.body.innerHTML = '<main>About</main>'
		const { bridge, setState } = fakeBridge()
		bridge.entryId = null
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt', 'create', 'save', 'form'] })
		expect($('.path').hidden).toBe(false)
		expect($('.mode').hidden).toBe(true)
		expect(button('Save draft').hidden).toBe(true)
		expect($('.note > span:not(.icon)').textContent).toBe('New page')

		const path = $<HTMLInputElement>('.path input')
		path.value = '/pricing'
		path.dispatchEvent(new Event('input'))
		type('A pricing page')
		await vi.waitFor(() =>
			expect(bridge.createPage).toHaveBeenCalledWith(
				'/pricing',
				'A pricing page',
			),
		)
		await vi.waitFor(() =>
			expect($('.answer .summary').textContent).toBe('Opening the new page…'),
		)
	})

	it('offers a product page on a product without one', async () => {
		document.body.innerHTML = '<main>Mug</main>'
		const { bridge, setState } = fakeBridge()
		bridge.entryId = null
		bridge.product = { id: 'gid://shopify/Product/1', handle: 'mug' }
		unmount = mountSiteEditor(document, bridge)
		setState({ features: ['prompt', 'create'] })
		expect($('.shop').hidden).toBe(false)
		expect($('.composer').hidden).toBe(true)
		button('Add a product page').click()
		await vi.waitFor(() =>
			expect($('.shop').textContent).toContain('Opening the product page…'),
		)
		expect(bridge.createProductPage).toHaveBeenCalled()
	})

	it('removes everything it added', () => {
		const { bridge, setState } = fakeBridge()
		const remove = mountSiteEditor(document, bridge)
		setState({ features: ['prompt'] })
		remove()
		expect(document.querySelector('[data-obelism-content-editor]')).toBeNull()
		expect(document.documentElement.hasAttribute('data-obelism-editor')).toBe(
			false,
		)
		expect(document.documentElement.hasAttribute('data-obelism-docked')).toBe(
			false,
		)
		expect(
			document.documentElement.style.getPropertyValue('--obelism-dock'),
		).toBe('')
	})
})
