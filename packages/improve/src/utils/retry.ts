/**
 * @function parseRetryAfterMs
 * @description Parse an HTTP `Retry-After` header into milliseconds. Supports
 * both the delta-seconds form (`"120"`) and the HTTP-date form
 * (`"Wed, 21 Oct 2026 07:28:00 GMT"`). Returns `undefined` when the header is
 * absent or unparseable so the caller can fall back to computed backoff.
 *
 * @param {string | null} [header] - the raw `Retry-After` header value
 * @param {number} [now] - current epoch ms (injectable for testing)
 */
export const parseRetryAfterMs = (
	header: string | null | undefined,
	now: number = Date.now(),
): number | undefined => {
	if (!header) return undefined

	const seconds = Number(header)
	if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000))

	const date = Date.parse(header)
	if (Number.isNaN(date)) return undefined

	return Math.max(0, date - now)
}

/**
 * @function getBackoffDelayMs
 * @description Exponential backoff with full jitter, capped at `maxDelay`.
 * Jitter spreads retries so concurrent clients don't stampede the origin in
 * lockstep after a shared failure.
 *
 * @param {number} attempt - zero-based retry attempt index
 * @param {number} baseDelay - base delay in ms
 * @param {number} maxDelay - upper bound in ms
 */
export const getBackoffDelayMs = (
	attempt: number,
	baseDelay: number,
	maxDelay: number,
): number => {
	const exponential = Math.min(maxDelay, baseDelay * 2 ** attempt)
	return Math.round(Math.random() * exponential)
}
