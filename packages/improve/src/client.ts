import { ParsedUserAgent, parseUserAgent } from './utils/parseUserAgent'
import { getVisitorMatchesAudience } from './utils/getVisitorMatchesAudience'
import { getRandomTestValue } from './utils/getRandomTestValue'
import { BaseImproveSDK } from './base'
import { getCookie, setCookie } from './utils/clientCookie'
import {
	ANALYTIC_RATE_LIMIT_COOLDOWN_MS,
	MAX_ANALYTIC_BODY_BYTES,
	MAX_ANALYTIC_FIELD_LENGTH,
	MAX_CURRENCY_FIELD_LENGTH,
} from './config/constants'
import { ANALYTICS_PATH, BASE_URL } from './config/urls'
import { getScreenSize } from './utils/getScreenSize'
import { isSnakeCaseEventName } from './utils/isSnakeCaseEventName'
import { pushDataLayer, resetDataLayerEcommerce } from './utils/pushDataLayer'
import { parseRetryAfterMs } from './utils/retry'
import { truncate } from './utils/truncate'
import {
	ImproveAnalyticPayload,
	ImproveEnvironmentOption,
	ImproveEventName,
	ImproveSetupArgs,
} from './types'

type Visitor = ParsedUserAgent & {
	[testSlug: string]: string
}

// Fields common to every beacon, regardless of type.
type BeaconCommon<T extends 'event' | 'exposure'> = {
	type: T
	organizationId: string
	environment: ImproveEnvironmentOption

	visitorId: string

	pointer: string
	device: string
	screen: string
	browser: string
	os: string
	visitor: string
}

/**
 * A real-world tracked event. Test-independent — the server attributes it to a
 * test/flag at read time by joining the visitor's exposures.
 */
export type CreateEvent = BeaconCommon<'event'> & {
	event: string
	scope: string

	/** GA4-aligned numeric value aggregated into revenue / AOV per variant. */
	value?: number
	/** ISO 4217 currency for `value`. */
	currency?: string
	/** Extra event params stored as JSON (e.g. a GA4 `ecommerce` object). */
	params?: Record<string, unknown>
}

/**
 * A visitor's assignment to a test/flag variant, emitted the first time the SDK
 * resolves a non-holdout value for them. The per-variant exposure count is the
 * denominator for results.
 */
export type CreateExposure = BeaconCommon<'exposure'> & {
	subjectKind: 'test' | 'flag'
	subjectId: string
	variant: string
}

// Events already sent this instance, keyed by event name (or `event:dedupeKey`
// when the caller passes one), so each fires at most once per page/session.
type TrackedEvents = {
	[event: string]: boolean
}

// Exposures already sent this instance, keyed by `${subjectKind}:${subjectId}`.
type TrackedExposures = {
	[subject: string]: boolean
}

export class ImproveClientSDK extends BaseImproveSDK {
	#visitor: Visitor | undefined
	#visitorRecurring: boolean = false

	#visitorId: string = ''

	#analytics: TrackedEvents = {}

	#exposures: TrackedExposures = {}

	// Epoch ms until which analytics posting is suspended after a 429.
	#rateLimitedUntil: number = 0

	// Event names already warned about, so the snake_case nudge fires once per
	// offending name instead of on every call.
	#warnedEventNames = new Set<string>()

	// Fires the missing-scope warning at most once per SDK instance, not once
	// per call — a caller that forgets `scope` is likely forgetting it everywhere.
	#warnedMissingScope = false

	#analyticsUrl = `${BASE_URL}${ANALYTICS_PATH}`

	#dataLayerEnabled: boolean = true

	fetchConfig = this._fetchConfig

	constructor(args: ImproveSetupArgs) {
		super(args)
		this.#analyticsUrl = `${this._baseUrl}${ANALYTICS_PATH}`
		this.#dataLayerEnabled = args.dataLayer ?? true
	}

	setupVisitor = (userAgent: string = window.navigator.userAgent) => {
		const cookieVisitorId = getCookie(this.getVisitorCookieName())
		const validCookieVisitorId =
			cookieVisitorId && this.validateVisitorId(cookieVisitorId)

		this.#visitorRecurring = validCookieVisitorId
		this.#visitorId = validCookieVisitorId
			? cookieVisitorId
			: this.generateVisitorId()

		const parsedUserAgent = parseUserAgent(userAgent)

		if (!parsedUserAgent) return null

		this.#visitor = parsedUserAgent

		setCookie(this.getVisitorCookieName(), this.#visitorId)

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
		this.#analyticsUrl = url
	}

	// Fields shared by every beacon. Callers must ensure the visitor is set up.
	#beaconCommon = <T extends 'event' | 'exposure'>(
		type: T,
	): BeaconCommon<T> => ({
		type,
		organizationId: this.organizationId,
		environment: this.environment,
		visitorId: this.#visitorId,
		pointer: this.#visitor!.pointer,
		device: this.#visitor!.device,
		screen: getScreenSize(),
		browser: this.#visitor!.browser,
		os: this.#visitor!.os,
		visitor: this.#visitorRecurring ? 'recurring' : 'new',
	})

	// Sends a beacon with a `keepalive` fetch so it outlives a navigation/unload,
	// warns on oversized bodies, and backs off on a 429. Shared by events and
	// exposures.
	#send = (body: CreateEvent | CreateExposure, label: string) => {
		// Serialize once so we can both measure and send the same bytes.
		const serializedBody = JSON.stringify(body)

		// The backend rejects bodies over 8KB with a 413 — realistically only an
		// oversized `params` (e.g. a large GA4 `ecommerce.items` array) gets there.
		if (
			typeof TextEncoder !== 'undefined' &&
			new TextEncoder().encode(serializedBody).length > MAX_ANALYTIC_BODY_BYTES
		) {
			this._warn(
				`Beacon for "${label}" exceeds the ${MAX_ANALYTIC_BODY_BYTES}-byte ` +
					`limit and will be rejected by the server — trim the \`params\` payload.`,
			)
		}

		const request = fetch(this.#analyticsUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: serializedBody,
			keepalive: true,
		})

		// Back off when the org hits its usage/rate limit. Honor a server
		// Retry-After when present, otherwise use a fixed cooldown.
		request
			.then((res) => {
				if (res?.status === 429) {
					const retryAfterMs = parseRetryAfterMs(res.headers.get('Retry-After'))
					this.#rateLimitedUntil =
						Date.now() + (retryAfterMs ?? ANALYTIC_RATE_LIMIT_COOLDOWN_MS)
				}
			})
			.catch(() => {})

		return request
	}

	// Emits an exposure beacon the first time a visitor is assigned to a subject
	// this instance. Idempotent server-side (unique per visitor+subject).
	#postExposure = (
		subjectKind: 'test' | 'flag',
		subjectId: string,
		variant: string,
	) => {
		if (!this.#visitor || !this.#visitorId) return

		// Suspended after a 429: skip, but don't mark tracked so it can retry later.
		if (Date.now() < this.#rateLimitedUntil) return

		const key = `${subjectKind}:${subjectId}`
		if (this.#exposures[key]) return
		this.#exposures[key] = true

		const body: CreateExposure = {
			...this.#beaconCommon('exposure'),
			subjectKind,
			subjectId,
			variant,
		}

		return this.#send(body, key)
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

		// Nudge developers toward the snake_case / GA4 naming convention. Warn
		// once per offending name so it's noticeable without spamming the console;
		// silence entirely with the `disableWarnings` setup option.
		if (!isSnakeCaseEventName(event) && !this.#warnedEventNames.has(event)) {
			this.#warnedEventNames.add(event)
			this._warn(
				`Event name "${event}" isn't snake_case. Prefer GA4-style names ` +
					`like "add_to_cart" or "purchase" so your events line up with ` +
					`GA4 / Google Tag Manager. Pass \`disableWarnings: true\` at setup ` +
					`to silence this.`,
			)
		}

		if (!scope && !this.#warnedMissingScope) {
			this.#warnedMissingScope = true
			this._warn(
				`postAnalytic("${event}", ...) was called with an empty scope. ` +
					`scope is required — pass a short, stable identifier for where/what ` +
					`this event refers to, e.g. "homepage_hero_login".`,
			)
		}

		// Suspended after a 429: skip sending, but don't mark the event as
		// tracked, so it can still fire once the cooldown elapses.
		if (Date.now() < this.#rateLimitedUntil) return null

		const { value, currency, params, dedupeKey }: ImproveAnalyticPayload =
			payload ?? {}
		const hasValue = typeof value === 'number' && Number.isFinite(value)
		// The backend requires `params` to be a plain (non-array) object and 400s
		// the whole event otherwise — drop an invalid value rather than lose the
		// event.
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

		this.#analytics[trackingKey] = true

		const body: CreateEvent = {
			...this.#beaconCommon('event'),
			// Cap developer-controlled fields to the backend's varchar(256) limit;
			// an over-length value is otherwise rejected with a 400 and the event
			// is lost.
			event: truncate(event, MAX_ANALYTIC_FIELD_LENGTH),
			scope: truncate(scope || '', MAX_ANALYTIC_FIELD_LENGTH),
			...(hasValue ? { value } : {}),
			...(currency
				? { currency: truncate(currency, MAX_CURRENCY_FIELD_LENGTH) }
				: {}),
			...(validParams ? { params: validParams } : {}),
		}

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
				...(validParams ?? {}),
				_improve: true,
			})
		}

		return this.#send(body, trackingKey)
	}
}
