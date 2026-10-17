import { expect, test } from 'vitest'

import { getReasonFromStatus, ImproveFetchError } from './errors'

test('getReasonFromStatus maps HTTP statuses to reasons', () => {
	expect(getReasonFromStatus(429)).toBe('rate-limited')
	expect(getReasonFromStatus(401)).toBe('unauthorized')
	expect(getReasonFromStatus(403)).toBe('unauthorized')
	expect(getReasonFromStatus(500)).toBe('server')
	expect(getReasonFromStatus(503)).toBe('server')
	expect(getReasonFromStatus(400)).toBe('client')
	expect(getReasonFromStatus(404)).toBe('client')
})

test('ImproveFetchError carries status and retryAfter and has a message', () => {
	const error = new ImproveFetchError('rate-limited', {
		status: 429,
		retryAfterMs: 5000,
	})
	expect(error).toBeInstanceOf(Error)
	expect(error.name).toBe('ImproveFetchError')
	expect(error.reason).toBe('rate-limited')
	expect(error.status).toBe(429)
	expect(error.retryAfterMs).toBe(5000)
	expect(error.message).toMatch(/rate limited/i)
})

test('isRetryable only for transient reasons', () => {
	expect(new ImproveFetchError('rate-limited').isRetryable).toBe(true)
	expect(new ImproveFetchError('server').isRetryable).toBe(true)
	expect(new ImproveFetchError('timeout').isRetryable).toBe(true)
	expect(new ImproveFetchError('network').isRetryable).toBe(true)
	expect(new ImproveFetchError('unauthorized').isRetryable).toBe(false)
	expect(new ImproveFetchError('client').isRetryable).toBe(false)
	expect(new ImproveFetchError('invalid-response').isRetryable).toBe(false)
})
