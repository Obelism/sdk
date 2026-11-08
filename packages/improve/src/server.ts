import {
	assign,
	createVisitor,
	flagSubject,
	testSubject,
	type Assignment,
	type Visitor,
} from './assignment'
import { parseUserAgent } from './utils/parseUserAgent'
import { BaseImproveSDK } from './base'
import { type TokenSource, resolveToken } from './tokenSource'
import { ImproveConfiguration, ImproveSetupArgs } from './types'

const DEFAULT_MAX_VISITORS = 10_000
// One visitor id with endless user agents would otherwise grow without bound.
const MAX_USER_AGENTS_PER_VISITOR = 10
// Days a seeded cookie lasts, as long as the browser SDK's.
const DEFAULT_SEED_DAYS = 30
const SAFE_ID = /^[A-Za-z0-9_-]+$/

// A Map, not an object: the user agent is the request's, and `__proto__`
// would be Object.prototype.
type VisitorData = Map<string, Visitor>

export type ImproveSeedArgs = {
	// The request's `Cookie` header. Only the visitor's cookie and the ones
	// named after a test or flag are read.
	cookieHeader?: string | null | undefined
	userAgent: string
	// Coarse geo from the request, as for getTestValue: the browser can't know
	// a visitor's country.
	geo?: { country?: string | undefined } | undefined
	// How long a cookie lasts, in days. Defaults to 30, the browser SDK's.
	maxAgeDays?: number | undefined
	// Mark the cookies `Secure`. On by default; turn it off to develop over
	// http on localhost.
	secure?: boolean | undefined
}

export type ImproveSeededCookie = {
	name: string
	value: string
	kind: 'visitor' | 'test' | 'flag'
	// Ready for a `Set-Cookie` header.
	header: string
}

export type ImproveSeededAssignment = {
	slug: string
	kind: 'test' | 'flag'
	// The option this visitor gets, which is the test's default for a visitor
	// outside it.
	value: string
	// False for a visitor outside the test's or flag's audience, or the test's
	// allocation: they see the default option and nothing is exposed.
	included: boolean
}

export type ImproveSeed = {
	visitorId: string
	cookies: ImproveSeededCookie[]
	assignments: ImproveSeededAssignment[]
}

type ImproveServerSetupArgs =
	| (Omit<ImproveSetupArgs, 'config' | 'baseUrl'> & {
			config: ImproveConfiguration
			maxVisitors?: number
	  })
	| (Omit<ImproveSetupArgs, 'config'> & {
			// An API token (`imp_…`), or a function giving one per request,
			// like `vercelOidc()` from `@obelism/improve-sdk/oidc`.
			token: TokenSource
			maxVisitors?: number
	  })

export class ImproveServerSDK extends BaseImproveSDK {
	#visitors: Map<string, VisitorData> = new Map()
	#maxVisitors: number
	#token: TokenSource

	// @ts-ignore It could be there
	constructor({ token, maxVisitors, ...args }: ImproveServerSetupArgs) {
		super(args)
		this.#token = token
		this.#maxVisitors = maxVisitors ?? DEFAULT_MAX_VISITORS
	}

	fetchConfig = async (config?: RequestInit) => {
		return this._fetchConfig({
			...config,
			headers: {
				...config?.headers,
				token: await resolveToken(this.#token),
			},
		})
	}

	getFlagConfig = (flagSlug: string) => this.config?.flags?.[flagSlug]

	getTestConfig = (testSlug: string) => this.config?.tests?.[testSlug]

	// The visitor as seen with this user agent, or null when it can't be
	// parsed (an empty user agent), which gets the default like a holdout.
	#getVisitor = (visitorId: string, userAgent: string): Visitor | null => {
		let visitor = this.#visitors.get(visitorId)
		if (visitor) {
			// Move to end for LRU freshness
			this.#visitors.delete(visitorId)
			this.#visitors.set(visitorId, visitor)
		} else {
			if (this.#visitors.size >= this.#maxVisitors) {
				const oldest = this.#visitors.keys().next().value
				if (oldest) this.#visitors.delete(oldest)
			}
			visitor = new Map()
			this.#visitors.set(visitorId, visitor)
		}
		const known = visitor.get(userAgent)
		if (known) return known
		const parsed = parseUserAgent(userAgent)
		if (!parsed) return null
		if (visitor.size >= MAX_USER_AGENTS_PER_VISITOR) {
			visitor.delete(visitor.keys().next().value!)
		}
		const fresh = createVisitor(parsed)
		visitor.set(userAgent, fresh)
		return fresh
	}

	// A flag's or test's value for a visitor, and how they got it: `default`
	// and `none` mean they are not in it.
	#assignment = (
		kind: 'test' | 'flag',
		slug: string,
		visitorId: string,
		userAgent: string,
		geo?: { country?: string | undefined },
		known?: string | null,
	): Assignment => {
		const config = this.config
		if (!config) return { value: null, source: 'none' }

		if (kind === 'flag') {
			const flag = this.getFlagConfig(slug)
			if (!flag) return { value: null, source: 'none' }
			const fallback = flag.options[0]?.slug ?? null
			if (!visitorId) return { value: fallback, source: 'default' }

			const visitor = this.#getVisitor(visitorId, userAgent)
			if (!visitor) return { value: fallback, source: 'default' }
			if (geo?.country) visitor.params.country = geo.country

			return assign(
				flagSubject(slug, flag),
				config.audience[flag.audience],
				visitor,
				known,
			)
		}

		const test = this.getTestConfig(slug)
		if (!test) return { value: null, source: 'none' }
		if (!visitorId) return { value: test.defaultValue, source: 'default' }

		const visitor = this.#getVisitor(visitorId, userAgent)
		if (!visitor) return { value: test.defaultValue, source: 'default' }
		if (geo?.country) visitor.params.country = geo.country

		return assign(
			testSubject(slug, test),
			config.audience[test.audience],
			visitor,
			known,
		)
	}

	getFlagValue = (
		flagSlug: string,
		visitorId: string,
		userAgent: string,
		// Coarse geo from the request (SSR/middleware), so audiences can target by
		// country. The browser can't determine this, so it's passed in here.
		geo?: { country?: string | undefined },
	) => this.#assignment('flag', flagSlug, visitorId, userAgent, geo).value

	getTestValue = (
		testSlug: string,
		visitorId: string,
		userAgent: string,
		// Coarse geo from the request (SSR/middleware), so audiences can target by
		// country. The browser can't determine this, so it's passed in here.
		geo?: { country?: string | undefined },
	) => this.#assignment('test', testSlug, visitorId, userAgent, geo).value

	// What a server should set before it sends a page: the visitor, and a cookie
	// per test and flag the visitor is in. A visitor outside a test's audience
	// or allocation gets its default option and no cookie, so a page that
	// carries every variant shows the default and records no exposure.
	seedTestCookies = (args: ImproveSeedArgs): ImproveSeed => {
		if (!this.config)
			throw new Error(
				'Config is required before seeding, either use `.fetchConfig()`, .loadConfig(config) or provide it during setup',
			)

		const read = parseCookies(args.cookieHeader)
		const visitorName = this.getVisitorCookieName()
		const knownVisitor =
			read.get(visitorName) ?? read.get(this.getLegacyVisitorCookieName())
		const visitorId =
			knownVisitor &&
			this.validateVisitorId(knownVisitor) &&
			// A cookie is echoed back below, so only an id of the alphabet the
			// SDK mints goes in.
			SAFE_ID.test(knownVisitor)
				? knownVisitor
				: this.generateVisitorId()

		const maxAge =
			Math.max(1, Math.round(args.maxAgeDays ?? DEFAULT_SEED_DAYS)) * 86_400
		const attributes = `Path=/; Max-Age=${maxAge}; SameSite=Lax${
			args.secure === false ? '' : '; Secure'
		}`
		const cookies: ImproveSeededCookie[] = []
		const set = (
			kind: ImproveSeededCookie['kind'],
			name: string,
			value: string,
		) => {
			cookies.push({
				kind,
				name,
				value,
				header: `${name}=${value}; ${attributes}`,
			})
		}

		// Also when a legacy cookie already names them, so the next read finds
		// the namespaced one.
		if (read.get(visitorName) !== visitorId)
			set('visitor', visitorName, visitorId)

		const subjects: { slug: string; kind: 'test' | 'flag' }[] = [
			...Object.keys(this.config.tests).map((slug) => ({
				slug,
				kind: 'test' as const,
			})),
			...Object.keys(this.config.flags).map((slug) => ({
				slug,
				kind: 'flag' as const,
			})),
		]

		const assignments: ImproveSeededAssignment[] = []
		for (const { slug, kind } of subjects) {
			const known = read.get(slug) ?? null
			const { value, source } = this.#assignment(
				kind,
				slug,
				visitorId,
				args.userAgent,
				args.geo,
				known,
			)
			if (!value) continue

			const included =
				source === 'visitor' || source === 'cookie' || source === 'new'
			assignments.push({ slug, kind, value, included })
			if (included && value !== known) set(kind, slug, value)
		}

		return { visitorId, cookies, assignments }
	}
}

// `a=b; c=d`, first `=` splitting, so a value may hold one.
const parseCookies = (header?: string | null) => {
	const cookies = new Map<string, string>()
	for (const row of header?.split(/;\s*/) ?? []) {
		const index = row.indexOf('=')
		if (index > 0) cookies.set(row.slice(0, index), row.slice(index + 1))
	}
	return cookies
}
