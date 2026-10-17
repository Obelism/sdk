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
