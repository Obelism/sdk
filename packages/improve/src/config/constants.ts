// Where a visitor's id lives, in the SDKs' shared cookie, and what one looks
// like: `@obelism/numbers-sdk`'s, so a visitor is one in both.
export {
	LEGACY_VISITOR_COOKIE,
	VISITOR_COOKIE as COOKIE_NAME_VISITOR,
} from '@obelism/numbers-sdk'

export const CONFIG_RETRY_COUNT = 2

export const CONFIG_RETRY_BASE_DELAY_MS = 300

export const CONFIG_RETRY_MAX_DELAY_MS = 3000
