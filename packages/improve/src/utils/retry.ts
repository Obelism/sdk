/**
 * Exponential backoff with full jitter, capped at `maxDelay`. Jitter spreads
 * retries so concurrent clients don't stampede the origin in lockstep after a
 * shared failure.
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
