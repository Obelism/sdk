import type { ImproveAudienceValue, ImproveFlag, ImproveTest } from './types'
import { getRandomTestValue } from './utils/getRandomTestValue'
import { getVisitorMatchesAudience } from './utils/getVisitorMatchesAudience'
import type { ParsedUserAgent } from './utils/parseUserAgent'

// What the browser SDK and the server SDK decide alike: which value of a test
// or flag a visitor gets. They differ only in where they keep the visitor
// (a cookie on the page, memory on the server), which is each SDK's own.

// A visitor's categories, which audiences match on, and the values assigned to
// them, by test or flag slug.
export type Visitor = {
	params: ParsedUserAgent
	assigned: Map<string, string>
}

export const createVisitor = (params: ParsedUserAgent): Visitor => ({
	params,
	assigned: new Map(),
})

// A test or flag as the decision needs it.
export type Subject = {
	slug: string
	// The value a visitor gets when they're not in it.
	fallback: string | null
	// Share of visitors in it, out of 100.
	allocation: number
	options: readonly { slug: string; split: number }[]
}

export const testSubject = (slug: string, test: ImproveTest): Subject => ({
	slug,
	fallback: test.defaultValue,
	allocation: test.allocation,
	options: test.options,
})

export const flagSubject = (slug: string, flag: ImproveFlag): Subject => ({
	slug,
	fallback: flag.options[0]?.slug ?? null,
	allocation: 100,
	options: flag.options,
})

export type AssignmentSource =
	// Already theirs, from an earlier call here.
	| 'visitor'
	// A cookie an earlier request (middleware) set.
	| 'cookie'
	// Assigned now.
	| 'new'
	// Not in it: no audience match, or outside the allocation.
	| 'default'
	// Nothing to assign: the test or flag has no options.
	| 'none'

export type Assignment = { value: string | null; source: AssignmentSource }

// The value `visitor` gets from `subject`: the one they have, else the one a
// cookie gives them, else one they're assigned now (remembered on them), else
// the fallback. `known` is a value a cookie says they have; it is only taken
// when the subject has that value.
export const assign = (
	subject: Subject,
	audience: ImproveAudienceValue | undefined,
	visitor: Visitor | null,
	known?: string | null,
): Assignment => {
	if (!visitor) return { value: subject.fallback, source: 'default' }

	const assigned = visitor.assigned.get(subject.slug)
	if (assigned !== undefined) return { value: assigned, source: 'visitor' }

	if (known && subject.options.some(({ slug }) => slug === known)) {
		visitor.assigned.set(subject.slug, known)
		return { value: known, source: 'cookie' }
	}

	if (!getVisitorMatchesAudience(audience, visitor.params))
		return { value: subject.fallback, source: 'default' }

	// Out of the allocation stays out: remembered, so a later call doesn't roll
	// again (no cookie and no exposure: they are not in the test).
	if (subject.allocation < 100 && Math.random() * 100 > subject.allocation) {
		if (subject.fallback !== null) {
			visitor.assigned.set(subject.slug, subject.fallback)
		}
		return { value: subject.fallback, source: 'default' }
	}

	const value = getRandomTestValue(subject.options)
	if (!value) return { value: null, source: 'none' }

	visitor.assigned.set(subject.slug, value)
	return { value, source: 'new' }
}
