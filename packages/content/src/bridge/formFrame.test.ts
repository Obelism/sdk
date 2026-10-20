// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	FORM_READY_TIMEOUT_MS,
	FORM_SOURCE,
	type FormFrame,
	mountFormFrame,
} from './formFrame'

const CMS = 'https://content.obelism.studio'
const FORM_URL = `${CMS}/site/form#code=once`

const CONTENT = {
	entryId: 'entry_1',
	content: { title: { en: 'Home' } },
	locale: 'en',
	selectedUid: null,
}

const setup = () => {
	const container = document.createElement('div')
	document.body.appendChild(container)
	const handlers = { onReady: vi.fn(), onChange: vi.fn(), onError: vi.fn() }
	const frame = mountFormFrame(window, container, FORM_URL, 'Form', handlers)
	const iframe = container.querySelector('iframe')!
	const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage')
	const receive = (
		data: unknown,
		{
			origin = CMS,
			source = iframe.contentWindow,
		}: { origin?: string; source?: Window | null } = {},
	) =>
		window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
	return { container, frame, iframe, handlers, postMessage, receive }
}

let frame: FormFrame | null = null
afterEach(() => {
	frame?.destroy()
	vi.useRealTimers()
	document.body.innerHTML = ''
})

describe('mountFormFrame', () => {
	it('opens the form, and sends it the content once it is ready', () => {
		const setUp = setup()
		frame = setUp.frame
		const { iframe, handlers, postMessage, receive } = setUp
		expect(iframe.src).toBe(FORM_URL)
		expect(iframe.title).toBe('Form')

		frame.show(CONTENT)
		expect(postMessage).not.toHaveBeenCalled()

		receive({ source: FORM_SOURCE, type: 'ready' })
		expect(handlers.onReady).toHaveBeenCalledTimes(1)
		expect(postMessage).toHaveBeenCalledWith(
			{ source: 'obelism-content-bridge', type: 'content', ...CONTENT },
			CMS,
		)

		const next = { ...CONTENT, selectedUid: 'b_1' }
		frame.show(next)
		expect(postMessage).toHaveBeenLastCalledWith(
			{ source: 'obelism-content-bridge', type: 'content', ...next },
			CMS,
		)
		// Ready again (the form reloaded): the content again.
		receive({ source: FORM_SOURCE, type: 'ready' })
		expect(postMessage).toHaveBeenCalledTimes(3)
	})

	it('waits for a form that loads the entry to show', () => {
		vi.useFakeTimers()
		const setUp = setup()
		frame = setUp.frame
		const { handlers, postMessage, receive } = setUp
		frame.show(CONTENT)

		// The content goes on ready; showing waits for loaded.
		receive({ source: FORM_SOURCE, type: 'ready', loading: true })
		expect(postMessage).toHaveBeenCalledTimes(1)
		expect(handlers.onReady).not.toHaveBeenCalled()
		receive({ source: FORM_SOURCE, type: 'loaded' })
		expect(handlers.onReady).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(FORM_READY_TIMEOUT_MS)
		expect(handlers.onError).not.toHaveBeenCalled()
	})

	it('says so when the form never loads', () => {
		vi.useFakeTimers()
		const setUp = setup()
		frame = setUp.frame
		const { handlers, receive } = setUp
		// Loaded before ready doesn't count.
		receive({ source: FORM_SOURCE, type: 'loaded' })
		receive({ source: FORM_SOURCE, type: 'ready', loading: true })
		vi.advanceTimersByTime(FORM_READY_TIMEOUT_MS)
		expect(handlers.onReady).not.toHaveBeenCalled()
		expect(handlers.onError).toHaveBeenCalledWith('The form did not open')
	})

	it('only listens to the form itself, on the CMS origin', () => {
		const setUp = setup()
		frame = setUp.frame
		const { handlers, receive } = setUp
		const change = {
			source: FORM_SOURCE,
			type: 'change',
			content: { title: { en: 'New' } },
		}
		receive(change, { origin: 'https://evil.test' })
		receive(change, { source: window })
		receive(change, { source: null })
		receive({ ...change, source: 'obelism-content-editor' })
		receive({ ...change, content: [1] })
		receive({ ...change, content: null })
		receive(null)
		expect(handlers.onChange).not.toHaveBeenCalled()

		receive(change)
		expect(handlers.onChange).toHaveBeenCalledWith(
			{ title: { en: 'New' } },
			undefined,
		)
		receive({ ...change, entryId: 'entry_2' })
		expect(handlers.onChange).toHaveBeenLastCalledWith(
			{ title: { en: 'New' } },
			'entry_2',
		)

		receive({ source: FORM_SOURCE, type: 'error', message: 'Session ended' })
		expect(handlers.onError).toHaveBeenLastCalledWith('Session ended')
		receive({ source: FORM_SOURCE, type: 'error' })
		expect(handlers.onError).toHaveBeenLastCalledWith('The form failed')
	})

	it('takes the height the form says it has, up to 60vh', () => {
		const setUp = setup()
		frame = setUp.frame
		const { iframe, receive } = setUp
		receive({ source: FORM_SOURCE, type: 'height', height: 312.4 })
		expect(iframe.style.height).toBe('min(312px, 60vh)')
		receive({ source: FORM_SOURCE, type: 'height', height: 5 })
		expect(iframe.style.height).toBe('min(80px, 60vh)')
		// Not from anywhere else, and only numbers.
		receive(
			{ source: FORM_SOURCE, type: 'height', height: 900 },
			{ origin: 'https://evil.example' },
		)
		receive({ source: FORM_SOURCE, type: 'height', height: '900px' })
		expect(iframe.style.height).toBe('min(80px, 60vh)')
	})

	it('says so when the form never gets ready', () => {
		vi.useFakeTimers()
		const setUp = setup()
		frame = setUp.frame
		vi.advanceTimersByTime(FORM_READY_TIMEOUT_MS)
		expect(setUp.handlers.onError).toHaveBeenCalledWith('The form did not open')
	})

	it('removes the form and stops listening', () => {
		vi.useFakeTimers()
		const { frame, iframe, handlers, receive } = setup()
		const contentWindow = iframe.contentWindow
		frame.destroy()
		expect(iframe.isConnected).toBe(false)
		receive({ source: FORM_SOURCE, type: 'ready' }, { source: contentWindow })
		vi.advanceTimersByTime(FORM_READY_TIMEOUT_MS)
		expect(handlers.onReady).not.toHaveBeenCalled()
		expect(handlers.onError).not.toHaveBeenCalled()
	})

	it('refuses an address that is no web page', () => {
		const container = document.createElement('div')
		const handlers = { onReady: vi.fn(), onChange: vi.fn(), onError: vi.fn() }
		for (const url of ['', 'javascript:alert(1)', '/site/form']) {
			expect(() =>
				mountFormFrame(window, container, url, 'Form', handlers),
			).toThrow('no form')
		}
		expect(container.children).toHaveLength(0)
	})
})
