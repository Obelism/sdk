import {
	assign,
	createVisitor,
	flagSubject,
	testSubject,
	type Visitor,
} from './assignment'
import { parseUserAgent } from './utils/parseUserAgent'
import { BaseImproveSDK } from './base'
import { type TokenSource, resolveToken } from './tokenSource'
import { ImproveConfiguration, ImproveSetupArgs } from './types'

const DEFAULT_MAX_VISITORS = 10_000
// One visitor id with endless user agents would otherwise grow without bound.
const MAX_USER_AGENTS_PER_VISITOR = 10

// A Map, not an object: the user agent is the request's, and `__proto__`
// would be Object.prototype.
type VisitorData = Map<string, Visitor>

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
			// Evict oldest entries when at capacity
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

	getFlagValue = (
		flagSlug: string,
		visitorId: string,
		userAgent: string,
		// Coarse geo from the request (SSR/middleware), so audiences can target by
		// country. The browser can't determine this, so it's passed in here.
		geo?: { country?: string | undefined },
	) => {
		const config = this.config
		const flag = this.getFlagConfig(flagSlug)
		if (!config || !flag) return null
		if (!visitorId) return flag.options[0]?.slug ?? null

		const visitor = this.#getVisitor(visitorId, userAgent)
		if (!visitor) return flag.options[0]?.slug ?? null
		if (geo?.country) visitor.params.country = geo.country

		return assign(
			flagSubject(flagSlug, flag),
			config.audience[flag.audience],
			visitor,
		).value
	}

	getTestValue = (
		testSlug: string,
		visitorId: string,
		userAgent: string,
		// Coarse geo from the request (SSR/middleware), so audiences can target by
		// country. The browser can't determine this, so it's passed in here.
		geo?: { country?: string | undefined },
	) => {
		const config = this.config
		const test = this.getTestConfig(testSlug)
		if (!config || !test) return null
		if (!visitorId) return test.defaultValue

		const visitor = this.#getVisitor(visitorId, userAgent)
		if (!visitor) return test.defaultValue
		if (geo?.country) visitor.params.country = geo.country

		return assign(
			testSubject(testSlug, test),
			config.audience[test.audience],
			visitor,
		).value
	}
}
