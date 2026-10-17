/**
 * A well-formed `snake_case` event name: starts with a lowercase letter and
 * contains only lowercase letters, digits, and single underscores between
 * segments. Matches the GA4 / GTM event-name convention Improve recommends
 * (`add_to_cart`, `sign_up`, `purchase`).
 */
const SNAKE_CASE_EVENT_NAME = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

/**
 * Whether `event` follows the recommended `snake_case` naming convention.
 * Flags camelCase (`pageView`), PascalCase (`AddToCart`), kebab-case
 * (`add-to-cart`), and names with spaces or trailing/double underscores.
 */
export const isSnakeCaseEventName = (event: string): boolean =>
	SNAKE_CASE_EVENT_NAME.test(event)
