import { ParsedUserAgent, parseUserAgent } from './utils/parseUserAgent'
import { getVisitorMatchesAudience } from './utils/getVisitorMatchesAudience'
import { getRandomTestValue } from './utils/getRandomTestValue'
import { BaseImproveSDK } from './base'
import { ImproveConfiguration, ImproveSetupArgs } from './types'

const DEFAULT_MAX_VISITORS = 10_000

type VisitorData = {
	[userAgent: string]: ParsedUserAgent & {
		[testSlug: string]: string
	}
}

type ImproveServerSetupArgs =
	| (Omit<ImproveSetupArgs, 'config' | 'baseUrl'> & {
			config: ImproveConfiguration
			maxVisitors?: number
	  })
	| (Omit<ImproveSetupArgs, 'config'> & {
			token: string
			maxVisitors?: number
	  })

export class ImproveServerSDK extends BaseImproveSDK {
	#visitors: Map<string, VisitorData> = new Map()
	#maxVisitors: number
	#token: string

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
				token: this.#token,
			},
		})
	}

	getFlagConfig = (flagSlug: string) => this.config?.flags?.[flagSlug]

	getTestConfig = (testSlug: string) => this.config?.tests?.[testSlug]

	#getVisitor = (visitorId: string, userAgent: string) => {
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
		visitor[userAgent] = visitor[userAgent] || parseUserAgent(userAgent)
		return visitor
	}

	getFlagValue = (
		flagSlug: string,
		visitorId: string,
		userAgent: string,
		// Coarse geo from the request (SSR/middleware), so audiences can target by
		// country. The browser can't determine this, so it's passed in here.
		geo?: { country?: string },
	) => {
		const flagConfig = this.getFlagConfig(flagSlug)

		if (!flagConfig || !this.config) return null
		if (!visitorId) return flagConfig.options[0].slug

		const visitor = this.#getVisitor(visitorId, userAgent)
		if (geo?.country && visitor[userAgent]) {
			visitor[userAgent].country = geo.country
		}

		if (visitor[userAgent]?.[flagSlug]) {
			return visitor[userAgent][flagSlug]
		}

		const visitorMatchesAudience = getVisitorMatchesAudience(
			this.config.audience[flagConfig.audience],
			visitor[userAgent],
		)

		if (!visitorMatchesAudience) return flagConfig.options[0].slug

		const flagValue = getRandomTestValue(flagConfig.options)

		if (!flagValue) return null

		visitor[userAgent][flagSlug] = flagValue
		return flagValue
	}

	getTestValue = (
		testSlug: string,
		visitorId: string,
		userAgent: string,
		// Coarse geo from the request (SSR/middleware), so audiences can target by
		// country. The browser can't determine this, so it's passed in here.
		geo?: { country?: string },
	) => {
		const testConfig = this.getTestConfig(testSlug)

		if (!testConfig || !this.config) return null

		if (!visitorId || !userAgent) return testConfig.defaultValue

		const visitor = this.#getVisitor(visitorId, userAgent)
		if (geo?.country && visitor[userAgent]) {
			visitor[userAgent].country = geo.country
		}

		if (visitor[userAgent]?.[testSlug]) {
			return visitor[userAgent][testSlug]
		}

		const visitorMatchesAudience = getVisitorMatchesAudience(
			this.config.audience[testConfig.audience],
			visitor[userAgent],
		)

		if (!visitorMatchesAudience) return testConfig.defaultValue

		if (
			testConfig.allocation < 100 &&
			Math.random() * 100 > testConfig.allocation
		) {
			visitor[userAgent][testSlug] = testConfig.defaultValue
			return visitor[userAgent][testSlug]
		}

		const testValue = getRandomTestValue(testConfig.options)

		if (!testValue) return null

		visitor[userAgent][testSlug] = testValue
		return testValue
	}
}
