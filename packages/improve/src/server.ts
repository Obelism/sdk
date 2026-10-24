import { ParsedUserAgent, parseUserAgent } from './utils/parseUserAgent'
import { getVisitorMatchesAudience } from './utils/getVisitorMatchesAudience'
import { getRandomTestValue } from './utils/getRandomTestValue'
import { BaseImproveSDK } from './base'
import { type TokenSource, resolveToken } from './tokenSource'
import { ImproveConfiguration, ImproveSetupArgs } from './types'

const DEFAULT_MAX_VISITORS = 10_000

type Visitor = ParsedUserAgent & {
	[testSlug: string]: string
}

type VisitorData = {
	[userAgent: string]: Visitor
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
			// Evict oldest entries when at capacity
			if (this.#visitors.size >= this.#maxVisitors) {
				const oldest = this.#visitors.keys().next().value
				if (oldest) this.#visitors.delete(oldest)
			}
			visitor = {}
			this.#visitors.set(visitorId, visitor)
		}
		const parsed = visitor[userAgent] || parseUserAgent(userAgent)
		if (!parsed) return null
		visitor[userAgent] = parsed
		return parsed
	}

	getFlagValue = (
		flagSlug: string,
		visitorId: string,
		userAgent: string,
		// Coarse geo from the request (SSR/middleware), so audiences can target by
		// country. The browser can't determine this, so it's passed in here.
		geo?: { country?: string | undefined },
	) => {
		const flagConfig = this.getFlagConfig(flagSlug)

		if (!flagConfig || !this.config) return null

		const defaultValue = flagConfig.options[0]?.slug ?? null
		if (!visitorId) return defaultValue

		const visitor = this.#getVisitor(visitorId, userAgent)
		if (!visitor) return defaultValue
		if (geo?.country) visitor.country = geo.country

		const assigned = visitor[flagSlug]
		if (assigned) return assigned

		const visitorMatchesAudience = getVisitorMatchesAudience(
			this.config.audience[flagConfig.audience],
			visitor,
		)

		if (!visitorMatchesAudience) return defaultValue

		const flagValue = getRandomTestValue(flagConfig.options)

		if (!flagValue) return null

		visitor[flagSlug] = flagValue
		return flagValue
	}

	getTestValue = (
		testSlug: string,
		visitorId: string,
		userAgent: string,
		// Coarse geo from the request (SSR/middleware), so audiences can target by
		// country. The browser can't determine this, so it's passed in here.
		geo?: { country?: string | undefined },
	) => {
		const testConfig = this.getTestConfig(testSlug)

		if (!testConfig || !this.config) return null

		if (!visitorId || !userAgent) return testConfig.defaultValue

		const visitor = this.#getVisitor(visitorId, userAgent)
		if (!visitor) return testConfig.defaultValue
		if (geo?.country) visitor.country = geo.country

		const assigned = visitor[testSlug]
		if (assigned) return assigned

		const visitorMatchesAudience = getVisitorMatchesAudience(
			this.config.audience[testConfig.audience],
			visitor,
		)

		if (!visitorMatchesAudience) return testConfig.defaultValue

		if (
			testConfig.allocation < 100 &&
			Math.random() * 100 > testConfig.allocation
		) {
			visitor[testSlug] = testConfig.defaultValue
			return testConfig.defaultValue
		}

		const testValue = getRandomTestValue(testConfig.options)

		if (!testValue) return null

		visitor[testSlug] = testValue
		return testValue
	}
}
