export const DEFAULT_ENDPOINT = 'https://numbers.obelism.studio/api/log'

// The visitor cookie and id format, shared with the improve SDK so a visitor
// is the same one in both: `visi_` and 26 characters.
export const VISITOR_COOKIE = 'visitorId'
export const VISITOR_ID_PREFIX = 'visi'
export const VISITOR_ID_SEPARATOR = '_'
export const VISITOR_ID_LENGTH = 26
export const VISITOR_COOKIE_DAYS = 30

// numbers' limits (`POST /api/log`): a longer string is a 400 and a bigger
// body a 413, and either loses the event, so the client caps what it can.
export const MAX_FIELD_LENGTH = 256
export const MAX_CURRENCY_LENGTH = 8
export const MAX_URL_LENGTH = 1024
export const MAX_BODY_BYTES = 8 * 1024

// How long to stop sending after a 429 without a `Retry-After`.
export const RATE_LIMIT_COOLDOWN_MS = 60_000
