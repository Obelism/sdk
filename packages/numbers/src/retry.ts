/**
 * The delay an HTTP `Retry-After` header asks for, in milliseconds: its
 * delta-seconds form (`120`) or its HTTP-date form. `undefined` when the header
 * is absent or unparseable, so the caller can fall back to its own backoff.
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
