import { describe, expect, it } from 'vitest'

import { routeMatcher } from './routes'

describe('routeMatcher', () => {
	const toRoute = routeMatcher([
		'/organization/[organizationId]',
		'/organization/[organizationId]/spaces/[spaceId]',
		'/organization/create',
		'/organization/[organizationId]/spaces/new',
	])

	it('reports a path as the pattern it matches', () => {
		expect(toRoute('/organization/org_1')).toBe(
			'/organization/[organizationId]',
		)
		expect(toRoute('/organization/org_1/spaces/space_2')).toBe(
			'/organization/[organizationId]/spaces/[spaceId]',
		)
	})

	it('prefers a static segment over a parameter', () => {
		expect(toRoute('/organization/create')).toBe('/organization/create')
		expect(toRoute('/organization/org_1/spaces/new')).toBe(
			'/organization/[organizationId]/spaces/new',
		)
	})

	it('leaves other paths, and an empty segment, as they are', () => {
		expect(toRoute('/pricing')).toBe('/pricing')
		expect(toRoute('/organization/')).toBe('/organization/')
		expect(toRoute('/organization/org_1/members')).toBe(
			'/organization/org_1/members',
		)
	})

	it('passes paths through without patterns', () => {
		expect(routeMatcher(undefined)('/a/b')).toBe('/a/b')
		expect(routeMatcher(['', 'tests/[id]'])('/tests/1')).toBe('/tests/1')
	})

	it('ignores a trailing slash on the path or the pattern', () => {
		expect(toRoute('/organization/org_1/')).toBe(
			'/organization/[organizationId]',
		)
		expect(routeMatcher(['/tests/[testId]/'])('/tests/1')).toBe(
			'/tests/[testId]/',
		)
		expect(routeMatcher(['/'])('/')).toBe('/')
	})
})
