export type ImproveFetchErrorReason =
	| 'timeout'
	| 'network'
	| 'unauthorized'
	| 'rate-limited'
	| 'server'
	| 'client'
	| 'invalid-response'

const REASON_MESSAGES: Record<ImproveFetchErrorReason, string> = {
	timeout: 'Configuration request timed out',
	network: 'Configuration request could not reach the server',
	unauthorized:
		'Configuration request was rejected (403): verify the organizationId, the server token, and that the request origin is whitelisted for this environment',
	'rate-limited':
		'Configuration request was rate limited (429): too many requests, or the organization usage limit was reached',
	server: 'Configuration request failed with a server error',
	client: 'Configuration request was rejected by the server',
	'invalid-response': 'Configuration response could not be parsed as JSON',
}

/**
 * Error thrown by the config fetch layer. Carries the HTTP `status`, a coarse
 * `reason`, and (when the server sent one) the `Retry-After` delay in ms, so
 * callers can distinguish a misconfiguration (unauthorized) from a transient
 * failure (rate-limited/server/timeout) instead of guessing from a string.
 */
export class ImproveFetchError extends Error {
	reason: ImproveFetchErrorReason
	status?: number
	retryAfterMs?: number

	constructor(
		reason: ImproveFetchErrorReason,
		options?: { status?: number; retryAfterMs?: number; cause?: unknown },
	) {
		super(REASON_MESSAGES[reason])
		this.name = 'ImproveFetchError'
		this.reason = reason
		this.status = options?.status
		this.retryAfterMs = options?.retryAfterMs
		if (options && 'cause' in options) {
			;(this as { cause?: unknown }).cause = options.cause
		}
	}

	/** Whether retrying the request could plausibly succeed. */
	get isRetryable() {
		return (
			this.reason === 'rate-limited' ||
			this.reason === 'server' ||
			this.reason === 'timeout' ||
			this.reason === 'network'
		)
	}
}

/** Map an HTTP status onto a coarse {@link ImproveFetchErrorReason}. */
export const getReasonFromStatus = (
	status: number,
): ImproveFetchErrorReason => {
	if (status === 429) return 'rate-limited'
	if (status === 401 || status === 403) return 'unauthorized'
	if (status >= 500) return 'server'
	return 'client'
}
