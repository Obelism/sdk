import {
	createNumbers,
	DEFAULT_ENDPOINT,
	type EventBeacon,
	type ExposureBeacon,
	type NumbersClient,
} from '@obelism/numbers-sdk'

import { ParsedUserAgent, parseUserAgent } from './utils/parseUserAgent'
import { getVisitorMatchesAudience } from './utils/getVisitorMatchesAudience'
import { getRandomTestValue } from './utils/getRandomTestValue'
import { BaseImproveSDK } from './base'
import { getCookie, setCookie } from './utils/clientCookie'
import { ANALYTICS_PATH } from './config/urls'
import { pushDataLayer, resetDataLayerEcommerce } from './utils/pushDataLayer'
import {
	ImproveAnalyticPayload,
	ImproveEventName,
	ImproveSetupArgs,
} from './types'

type Visitor = ParsedUserAgent & {
	[testSlug: string]: string
}

/**
 * A real-world tracked event. Test-independent — the server attributes it to a
 * test/flag at read time by joining the visitor's exposures. Sent through the
 * numbers SDK (`@obelism/numbers-sdk`), which adds the page's path and UTM tags.
 */
export type CreateEvent = EventBeacon

/**
 * A visitor's assignment to a test/flag variant, emitted the first time the SDK
 * resolves a non-holdout value for them. The per-variant exposure count is the
 * denominator for results.
 */
export type CreateExposure = ExposureBeacon

// Events already sent this instance, keyed by event name (or `event:dedupeKey`
// when the caller passes one), so each fires at most once per page/session.
type TrackedEvents = {
	[event: string]: boolean
}

export class ImproveClientSDK extends BaseImproveSDK {
	#visitor: Visitor | undefined
	#visitorId: string = ''

	#analytics: TrackedEvents = {}

	// Events and exposures go to Obelism numbers through its SDK, which keeps
	// the visitor cookie, the device categories, the page context, the size
	// and field limits, and backs off after a 429.
	#numbers: NumbersClient

	// Fires the missing-scope warning at most once per SDK instance, not once
	// per call — a caller that forgets `scope` is likely forgetting it everywhere.
	#warnedMissingScope = false

	#dataLayerEnabled: boolean = true

	fetchConfig = this._fetchConfig

	constructor(args: ImproveSetupArgs) {
		super(args)
		this.#numbers = createNumbers({
			organizationId: this.organizationId,
			environment: this.environment,
			// numbers takes the events; a custom `baseUrl` (e.g. a local Improve)
			// keeps getting them at its own /api/log.
			endpoint: args.baseUrl
				? `${args.baseUrl}${ANALYTICS_PATH}`
				: DEFAULT_ENDPOINT,
			disableWarnings: args.disableWarnings ?? false,
		})
		this.#dataLayerEnabled = args.dataLayer ?? true
	}

	setupVisitor = (userAgent: string = window.navigator.userAgent) => {
		// The numbers SDK reads (or makes) the visitor in the shared `visitorId`
		// cookie, so the visitor is the same one in numbers' own script.
		const visitor = this.#numbers.visitor()

		if (!visitor) return null

		this.#visitorId = visitor.id

		const parsedUserAgent = parseUserAgent(userAgent)

		if (!parsedUserAgent) return null

		this.#visitor = parsedUserAgent

		// The audiences' categories, so numbers reports the same ones.
		const { pointer, device, browser, os } = parsedUserAgent
		this.#numbers.setDevice({ pointer, device, browser, os })

		return this.#visitorId
	}

	getFlagValue = (flagSlug: string) => {
		if (!this.config) return null

		const flagConfig = this.config.flags[flagSlug]

		if (!flagConfig || !flagConfig.options[0]) return null

		if (!this.#visitor) this.setupVisitor()
		if (!this.#visitorId || !this.#visitor) return flagConfig.options[0].slug
		if (this.#visitor?.[flagSlug]) return this.#visitor[flagSlug]

		// Trust a prior assignment (a valid cookie) before re-evaluating audience,
		// keeping the visitor sticky and honoring a server-side (middleware)
		// country-targeted assignment.
		const cookieFlagValue = getCookie(flagSlug)
		if (
			cookieFlagValue &&
			flagConfig.options.some((option) => option.slug === cookieFlagValue)
		) {
			this.#visitor[flagSlug] = cookieFlagValue
			this.#postExposure('flag', flagConfig.id, cookieFlagValue)
			return cookieFlagValue
		}

		const visitorMatchesAudience = getVisitorMatchesAudience(
			this.config.audience[flagConfig.audience],
			this.#visitor,
		)

		if (!visitorMatchesAudience) return flagConfig.options[0].slug

		const flagValue = getRandomTestValue(flagConfig.options)

		if (!flagValue) return null

		this.#visitor[flagSlug] = flagValue

		setCookie(flagSlug, flagValue)

		// Record the assignment so the visitor's later events can be attributed to
		// this flag/variant server-side.
		this.#postExposure('flag', flagConfig.id, flagValue)

		return flagValue
	}

	getTestValue = (testSlug: string) => {
		if (!this.config) return null

		const testConfig = this.config.tests[testSlug]

		if (!testConfig) return null

		if (!this.#visitor) this.setupVisitor()

		if (!this.#visitorId || !this.#visitor) return testConfig.defaultValue
		if (this.#visitor?.[testSlug]) return this.#visitor[testSlug]

		// Trust a prior assignment (a valid cookie) before re-evaluating audience
		// or allocation, so a bucketed visitor stays sticky. This is also how a
		// country-targeted test resolves in the browser: middleware bucketed the
		// visitor server-side (where geo is known) and set the cookie, and here we
		// honor it and record the exposure.
		const cookieTestValue = getCookie(testSlug)
		if (cookieTestValue && this.validateTestValue(testSlug, cookieTestValue)) {
			this.#visitor[testSlug] = cookieTestValue
			this.#postExposure('test', testConfig.id, cookieTestValue)
			return cookieTestValue
		}

		const visitorMatchesAudience = getVisitorMatchesAudience(
			this.config.audience[testConfig.audience],
			this.#visitor,
		)

		if (!visitorMatchesAudience) return testConfig.defaultValue

		if (
			testConfig.allocation < 100 &&
			Math.random() * 100 > testConfig.allocation
		) {
			this.#visitor[testSlug] = testConfig.defaultValue
			return this.#visitor?.[testSlug]
		}

		const testValue = getRandomTestValue(testConfig.options)

		if (!testValue) return null

		this.#visitor[testSlug] = testValue

		setCookie(testSlug, testValue)

		// Record the assignment so the visitor's later events can be attributed to
		// this test/variant server-side. Holdout (allocation) and audience-excluded
		// visitors return above without an exposure — they aren't in the test.
		this.#postExposure('test', testConfig.id, testValue)

		return testValue
	}

	setAnalyticsUrls = (url: string) => {
		this.#numbers.setEndpoint(url)
	}

	// Emits an exposure beacon the first time a visitor is assigned to a subject
	// this instance (the numbers SDK sends each subject once). Idempotent
	// server-side (unique per visitor+subject).
	#postExposure = (
		subjectKind: 'test' | 'flag',
		subjectId: string,
		variant: string,
	) => {
		if (!this.#visitor || !this.#visitorId) return

		return this.#numbers.expose({ subjectKind, subjectId, variant })
	}

	postAnalytic = (
		event: ImproveEventName,
		// Required, freeform, but always present — the stable second half of the
		// event's identity (e.g. "homepage_hero_login"). Not a display string;
		// keep it structured and consistent, unlike the old `message` field.
		scope: string,
		payload?: ImproveAnalyticPayload,
	) => {
		if (!this.config) return null

		// GTM reserves the `gtm.*` namespace for its own events; never emit into
		// it, or the mirrored dataLayer entry would collide with GTM internals.
		if (event.startsWith('gtm.')) return null

		// The numbers SDK nudges toward snake_case names itself; an empty scope
		// is improve's own convention to warn about (numbers falls back to the
		// page's path).
		if (!scope && !this.#warnedMissingScope) {
			this.#warnedMissingScope = true
			this._warn(
				`postAnalytic("${event}", ...) was called with an empty scope. ` +
					`scope is required — pass a short, stable identifier for where/what ` +
					`this event refers to, e.g. "homepage_hero_login".`,
			)
		}

		const { value, currency, params, dedupeKey }: ImproveAnalyticPayload =
			payload ?? {}
		const hasValue = typeof value === 'number' && Number.isFinite(value)
		const validParams =
			params && typeof params === 'object' && !Array.isArray(params)
				? params
				: undefined

		if (!this.#visitor) this.setupVisitor()

		// The event is test-independent: it's recorded once per visitor and later
		// attributed to whichever tests/flags the visitor was exposed to. Dedup per
		// event name (or per `event:dedupeKey`, when the caller distinguishes
		// repeated firings of the same name) so it fires at most once per
		// page/session.
		const trackingKey = dedupeKey ? `${event}:${dedupeKey}` : event
		if (!this.#visitor || this.#analytics[trackingKey]) return null

		const request = this.#numbers.track(event, scope, {
			...(hasValue ? { value } : {}),
			...(currency ? { currency } : {}),
			...(validParams ? { params: validParams } : {}),
		})

		// Nothing sent (paused after a 429): don't mark the event as tracked, so
		// it can still fire once the cooldown elapses.
		if (!request) return null

		this.#analytics[trackingKey] = true

		if (this.#dataLayerEnabled) {
			// Clear any prior ecommerce object first so its keys don't bleed into
			// this event (GTM/GA4 best practice).
			if (validParams && 'ecommerce' in validParams) resetDataLayerEcommerce()

			pushDataLayer({
				event,
				scope,
				improve: {
					visitorId: this.#visitorId,
				},
				...(hasValue ? { value } : {}),
				...(currency ? { currency } : {}),
				// Spread custom params (incl. a GA4 `ecommerce` object) to the top
				// level so GA4/GTM tags can read them directly.
				...validParams,
				_improve: true,
			})
		}

		return request
	}
}
