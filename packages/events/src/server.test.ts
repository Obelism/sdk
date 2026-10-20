import { describe, expect, it, vi } from 'vitest'

import { getEvents } from './events'

// Server-side rendering emits too: it must not touch the DOM nor keep events.
describe('outside the browser', () => {
	it('emits nothing, keeps nothing and throws nothing', () => {
		const events = getEvents()
		const subscriber = vi.fn()
		expect(events.emit('sign_up')).toBe(false)
		expect(
			events.expose({ subjectKind: 'test', subjectId: 't', variant: 'a' }),
		).toBe(false)
		events.subscribe(subscriber)()
		events.autoTrack()()
		expect(subscriber).not.toHaveBeenCalled()
		expect(getEvents()).toBe(events)
	})
})
