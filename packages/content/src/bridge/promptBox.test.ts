// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type BridgeState, createEmitter, INITIAL_STATE } from './createBridge'
import { mountPromptBox } from './promptBox'

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
})
