export const COOKIE_NAME_VISITOR = 'visitorId'

export const VISITOR_ID_PREFIX = 'visi'

export const VISITOR_ID_LENGTH = 26

export const VISITOR_ID_SEPARATOR = '_'

/** Default number of retries for a failed config fetch (network / 5xx / 429). */
export const CONFIG_RETRY_COUNT = 2

/** Base delay for config-fetch backoff, in ms. */
export const CONFIG_RETRY_BASE_DELAY_MS = 300

/** Upper bound for a single config-fetch backoff wait, in ms. */
export const CONFIG_RETRY_MAX_DELAY_MS = 3000

/**
 * Max length of a single analytic string field. The backend rejects any
 * field longer than this (varchar(256)) with a 400, so the client caps
 * developer-controlled values (event, scope) to avoid silently dropping
 * the event.
 */
export const MAX_ANALYTIC_FIELD_LENGTH = 256

/**
 * Max length of the analytic `currency` field. The backend column is
 * `varchar(8)` (ISO 4217 is 3 chars), and a longer value throws at insert —
 * failing the *entire* event, not just the currency — so the client caps it
 * here rather than at the generic 256-char limit.
 */
export const MAX_CURRENCY_FIELD_LENGTH = 8

/**
 * Max size of the analytic POST body. The backend rejects anything larger with
 * a 413 (`MAX_BODY_BYTES = 8 * 1024`), so an oversized `params` payload silently
 * loses the event. Kept in sync with the backend limit.
 */
export const MAX_ANALYTIC_BODY_BYTES = 8 * 1024

/**
 * How long to stop sending analytics after the backend returns 429 (usage
 * limit / rate limit) without a `Retry-After`. Avoids hammering an org that is
 * already over its quota.
 */
export const ANALYTIC_RATE_LIMIT_COOLDOWN_MS = 60_000
