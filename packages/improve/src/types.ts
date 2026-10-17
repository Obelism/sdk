import { AudienceParamKey } from './config/audiences'

export type ImproveEnvironmentOption = 'develop' | 'staging' | 'production'

export type ImproveTestState = 'draft' | 'active' | 'finished' | 'archived'

export type ImproveSetupArgs = {
	organizationId: string
	environment: ImproveEnvironmentOption
	state?: ImproveTestState
	config?: ImproveConfiguration
	baseUrl?: string
	fetchTimeout?: number
	/**
	 * How many times to retry a failed config fetch before giving up. Only
	 * transient failures are retried (network errors, timeouts, HTTP 5xx, and
	 * 429 rate limits); auth/validation rejections (403/404/400) fail fast.
	 * Retries use exponential backoff with jitter and honor `Retry-After`.
	 * Defaults to 2. Set to 0 to disable retries (e.g. in latency-sensitive
	 * middleware).
	 */
	configRetries?: number
	/**
	 * When set, forwarded to the config fetch as `next: { revalidate }`
	 * (seconds), so Next.js / edge runtimes cache the config datafile between
	 * requests instead of fetching it on every request. The backend serves the
	 * datafile with a short `s-maxage` + `stale-while-revalidate`, so a small
	 * value here (e.g. 30) lets a deployment reuse it and shields the origin
	 * under load. No effect outside fetch implementations that honor
	 * `next.revalidate`.
	 */
	configRevalidate?: number
	/**
	 * Mirror analytics onto the GTM dataLayer (window.dataLayer) with experiment
	 * dimensions, so they can drive Google Tag Manager / Google Ads conversions.
	 * Enabled by default; set to `false` to opt out. No effect server-side.
	 */
	dataLayer?: boolean
	/**
	 * Silence all Improve development warnings (e.g. the nudge when an event name
	 * isn't `snake_case`). Warnings are on by default to steer teams toward the
	 * naming convention; set to `true` in production or to opt out entirely.
	 */
	disableWarnings?: boolean
}

export type ImproveFlagOption = {
	name: string
	slug: string
	value: string | undefined
	split: number
}

export type ImproveTestOption = {
	name: string
	slug: string
	value: string | undefined
	split: number
}

export type ImproveFlag = {
	id: string
	name: string
	audience: string
	options: ImproveFlagOption[]
}

export type ImproveFlags = {
	[flagSlug in string]: ImproveFlag
}

/**
 * Recommended analytic event names, aligned with the Google Analytics 4 /
 * Google Tag Manager recommended events. Reusing these means your Improve
 * events line up with any GA4/GTM tagging you already have — especially when
 * mirroring analytics onto the GTM dataLayer (`dataLayer` setup option).
 *
 * @see https://support.google.com/analytics/answer/9267735
 */
export type ImproveRecommendedEventName =
	| 'page_view'
	| 'view_item'
	| 'view_item_list'
	| 'select_item'
	| 'add_to_cart'
	| 'remove_from_cart'
	| 'view_cart'
	| 'begin_checkout'
	| 'add_payment_info'
	| 'add_shipping_info'
	| 'purchase'
	| 'refund'
	| 'sign_up'
	| 'login'
	| 'search'
	| 'select_content'
	| 'share'
	| 'generate_lead'

/**
 * The name of an analytic event, e.g. the `event` passed to `postAnalytic`.
 *
 * Prefer **`snake_case`** names (`add_to_cart`, `sign_up`, `purchase`) to match
 * GA4 / GTM conventions, and reuse the same name everywhere the action happens.
 * Common GA4 recommended names are offered as autocomplete suggestions, but any
 * string is accepted so you can still use your own custom event names.
 */
export type ImproveEventName = ImproveRecommendedEventName | (string & {})

/**
 * An event name paired with its required, freeform `scope` — the one
 * consistent key/value identity used everywhere (SDK, dashboard, test setup):
 * e.g. `{ event: 'button_click', scope: 'homepage_hero_login' }`. Unlike
 * `message` in previous SDK versions, `scope` is mandatory and expected to be
 * a stable, structured string (not display text) — see `postAnalytic`.
 */
export type ImproveEventRef = {
	event: ImproveEventName
	scope: string
}

export type ImproveEvents = {
	start: ImproveEventRef
	metrics: ImproveEventRef[]
	conversion: ImproveEventRef
	/**
	 * Ordered funnel steps for the multi-step conversion view, when the test
	 * defines one. The last step is the conversion; when absent, the funnel is
	 * `[start, ...metrics, conversion]`.
	 */
	funnel?: ImproveEventName[]
}

/**
 * Structured payload for an analytic event, aligned with Google Analytics 4
 * event parameters. `event` and `scope` are passed as `postAnalytic`'s first
 * two (required) arguments — everything here is optional extras.
 *
 * - `value` (with `currency`) is the numeric measure Improve aggregates into
 *   **revenue / average order value per variant** — pass an order total on your
 *   conversion event to compare not just how often a variant converts, but at
 *   what value.
 * - `params` is passed through to the GTM dataLayer and stored as JSON, but is
 *   not aggregated by Improve's own results. Use it for a GA4 `ecommerce`
 *   object (`{ ecommerce: { items: [...] } }`) or any custom event parameters.
 * - `dedupeKey` distinguishes repeated firings of the same event name — see
 *   below.
 */
export type ImproveAnalyticPayload = {
	/** Numeric value of the event, e.g. an order total. GA4 `value`. */
	value?: number
	/** ISO 4217 currency code for `value`, e.g. `'USD'`. GA4 `currency`. */
	currency?: string
	/**
	 * Extra event parameters, spread onto the GTM dataLayer entry and stored as
	 * JSON. Provide `{ ecommerce: {...} }` for GA4 ecommerce tags; the SDK clears
	 * the previous `ecommerce` object first to avoid data bleed between events.
	 */
	params?: Record<string, unknown>
	/**
	 * Distinguishes multiple firings of the same event name within one
	 * page/session, e.g. an item or promotion id for a `view_promotion` /
	 * `view_item_list` fired once per item. `postAnalytic` dedupes per `event`
	 * name by default; passing a `dedupeKey` scopes that dedup to `event` +
	 * `dedupeKey` instead, so the same event name can fire once per distinct
	 * subject rather than only once total. Not sent to the server or the
	 * dataLayer — local dedup only.
	 */
	dedupeKey?: string
}

export type ImproveResult = {
	result: {
		[variant: string]: {
			[metric: string]: number
		}
	}
	resultsByDay: {
		label: string
		values: { [x in string]: string | number }[]
	}[]
}

export type ImproveTest = {
	id: string
	name: string
	defaultValue: string
	audience: string
	allocation: number
	options: ImproveTestOption[]
	events: ImproveEvents
}

export type ImproveTests = {
	[testSlug in string]: ImproveTest
}

export type ImproveAudienceValue = { [Key in AudienceParamKey]: string }

export type ImproveAudience = {
	[audienceSlug in string]: ImproveAudienceValue
}

export type ImproveConfiguration = {
	name: string
	version: number
	flags: ImproveFlags
	tests: ImproveTests
	audience: ImproveAudience
}
