import type {
	ImproveAudienceValue,
	ImproveConfiguration,
	ImproveFlag,
	ImproveTest,
} from './types'
import { BUCKETS, bucketOf, inRanges, pickVariant } from './utils/buckets'
import { getRandomTestValue } from './utils/getRandomTestValue'
import { getVisitorMatchesAudience } from './utils/getVisitorMatchesAudience'
import type { ParsedUserAgent } from './utils/parseUserAgent'

// What the browser SDK and the server SDK decide alike: which value of a test
// or flag a visitor gets. They differ only in where they keep the visitor
// (a cookie on the page, memory on the server), which is each SDK's own.

// A visitor's categories, which audiences match on, and the values assigned to
// them, by test or flag slug.
export type Visitor = {
	// Numbers' visitor id, which buckets are taken of.
	id: string
	params: ParsedUserAgent
	assigned: Map<string, string>
	// The subjects a visitor was left out of, which are remembered so a later
	// call doesn't roll again. Kept apart from `assigned` so the source stays
	// `default`: a holdout is not in the test.
	heldOut: Set<string>
}

export const createVisitor = (params: ParsedUserAgent, id = ''): Visitor => ({
	id,
	params,
	assigned: new Map(),
	heldOut: new Set(),
})

// A test or flag as the decision needs it.
export type Subject = {
	slug: string
	// The value a visitor gets when they're not in it.
	fallback: string | null
	// Share of visitors in it, out of 100.
	allocation: number
	options: readonly { slug: string; split: number }[]
	// A test in an exclusion group or under a holdout (Improve's
	// docs/adr/0014): who is in it is decided by the visitor's id.
	buckets?: Buckets
}

type Buckets = {
	salt: string
	// The group's salt and the test's ranges of it. Without, entry is the
	// test's own bucket against its allocation.
	group?: { salt: string; ranges: readonly (readonly [number, number])[] }
	// The holdouts running over this test now.
	holdouts: { id: string; salt: string; share: number }[]
}

const runningHoldouts = (
	slug: string,
	config: ImproveConfiguration | null | undefined,
	now: number,
): Buckets['holdouts'] =>
	Object.entries(config?.holdouts ?? {}).flatMap(([id, holdout]) =>
		holdout.tests.includes(slug) &&
		Date.parse(holdout.start) <= now &&
		(holdout.end === null || now < Date.parse(holdout.end))
			? [{ id, salt: holdout.salt, share: holdout.share }]
			: [],
	)

const testBuckets = (
	slug: string,
	test: ImproveTest,
	config: ImproveConfiguration | null | undefined,
	now: number,
): Buckets | undefined => {
	if (!test.salt) return undefined
	const holdouts = runningHoldouts(slug, config, now)
	if (!test.group) return { salt: test.salt, holdouts }
	// A group the datafile doesn't name holds no buckets: nobody is in.
	const group = config?.groups?.[test.group]
	return {
		salt: test.salt,
		group: {
			salt: group?.salt ?? '',
			ranges: group ? (test.ranges ?? []) : [],
		},
		holdouts,
	}
}

export const testSubject = (
	slug: string,
	test: ImproveTest,
	config?: ImproveConfiguration | null,
	now: number = Date.now(),
): Subject => {
	const buckets = testBuckets(slug, test, config, now)
	return {
		slug,
		fallback: test.defaultValue,
		allocation: test.allocation,
		options: test.options,
		...(buckets && { buckets }),
	}
}

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

export type Assignment = {
	value: string | null
	source: AssignmentSource
	// The holdout keeping the visitor out of this test, which is exposed
	// instead of it.
	holdout?: string
	// The visitor is out of a bucketed test, so a cookie for it is stale.
	clear?: true
}

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
	if (subject.buckets)
		return assignByBucket(subject, subject.buckets, audience, visitor, known)

	const assigned = visitor.assigned.get(subject.slug)
	// A value that outlived its option (the datafile changed under a live
	// visitor) is not theirs any more.
	if (
		assigned !== undefined &&
		subject.options.some(({ slug }) => slug === assigned)
	)
		return {
			value: assigned,
			source: visitor.heldOut.has(subject.slug) ? 'default' : 'visitor',
		}

	if (known && subject.options.some(({ slug }) => slug === known)) {
		visitor.assigned.set(subject.slug, known)
		visitor.heldOut.delete(subject.slug)
		return { value: known, source: 'cookie' }
	}

	if (!getVisitorMatchesAudience(audience, visitor.params))
		return { value: subject.fallback, source: 'default' }

	// Out of the allocation stays out: remembered, so a later call doesn't roll
	// again (no cookie and no exposure: they are not in the test).
	if (subject.allocation < 100 && Math.random() * 100 > subject.allocation) {
		if (subject.fallback !== null) {
			visitor.assigned.set(subject.slug, subject.fallback)
			visitor.heldOut.add(subject.slug)
		}
		return { value: subject.fallback, source: 'default' }
	}

	const value = getRandomTestValue(subject.options)
	if (!value) return { value: null, source: 'none' }

	visitor.assigned.set(subject.slug, value)
	visitor.heldOut.delete(subject.slug)
	return { value, source: 'new' }
}

const hasOption = (subject: Subject, value: string | null | undefined) =>
	Boolean(value) && subject.options.some(({ slug }) => slug === value)

// Holdout and entry come from the visitor's id every time, before any cookie,
// so a cookie can't put a visitor in two tests of a group; inside the test, a
// cookie keeps the variant.
const assignByBucket = (
	subject: Subject,
	buckets: Buckets,
	audience: ImproveAudienceValue | undefined,
	visitor: Visitor,
	known: string | null | undefined,
): Assignment => {
	const out = (holdout?: string): Assignment => {
		visitor.assigned.delete(subject.slug)
		return {
			value: subject.fallback,
			source: 'default',
			...(holdout && { holdout }),
			...(known && { clear: true as const }),
		}
	}
	// Random entry would break a group's exclusivity.
	if (!visitor.id) return out()

	const holdout = buckets.holdouts.find(
		({ salt, share }) => bucketOf(salt, visitor.id) < share,
	)
	if (holdout) return out(holdout.id)

	const entered = buckets.group
		? inRanges(bucketOf(buckets.group.salt, visitor.id), buckets.group.ranges)
		: bucketOf(buckets.salt, visitor.id) < (subject.allocation / 100) * BUCKETS
	if (!entered) return out()

	const assigned = visitor.assigned.get(subject.slug)
	if (hasOption(subject, assigned))
		return { value: assigned!, source: 'visitor' }

	if (hasOption(subject, known)) {
		visitor.assigned.set(subject.slug, known!)
		return { value: known!, source: 'cookie' }
	}

	if (!getVisitorMatchesAudience(audience, visitor.params))
		return { value: subject.fallback, source: 'default' }

	const value = pickVariant(buckets.salt, visitor.id, subject.options)
	if (!value) return { value: null, source: 'none' }
	visitor.assigned.set(subject.slug, value)
	return { value, source: 'new' }
}
