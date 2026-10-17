import { describe, expect, it, vi } from 'vitest'

import { createNumbers } from './client'

// Server-side rendering creates the client too: it must not touch the DOM.
describe('outside the browser', () => {
	it('sends nothing and throws nothing', () => {
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		const numbers = createNumbers({ organizationId: 'org_1' })
		expect(numbers.visitor()).toBeNull()
		expect(numbers.track('sign_up', 'x')).toBeNull()
		expect(numbers.pageView()).toBeNull()
		expect(
			numbers.expose({ subjectKind: 'test', subjectId: 't', variant: 'a' }),
		).toBeNull()
		numbers.autoTrack()()
		expect(fetchMock).not.toHaveBeenCalled()
		vi.unstubAllGlobals()
	})
})
