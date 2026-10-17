import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { BaseImproveSDK } from './base'
import { ImproveConfiguration } from './types'
import { ImproveFetchError } from './utils/errors'

const CONFIG: ImproveConfiguration = {
	name: 'test',
	version: 1,
	flags: {},
	tests: {},
	audience: {},
}

const makeResponse = (
	status: number,
	body: unknown,
	headers: Record<string, string> = {},
) =>
	({
		ok: status >= 200 && status < 300,
		status,
		headers: {
			get: (key: string) => headers[key] ?? headers[key.toLowerCase()] ?? null,
		},
		json: async () => body,
	}) as unknown as Response

const setup = (extra: Record<string, unknown> = {}) =>
	new BaseImproveSDK({
		organizationId: 'org_1',
		environment: 'develop',
		...extra,
	})

beforeEach(() => {
	// Zero out backoff jitter so retries resolve without real waiting.
	vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

test('resolves and stores config on success', async () => {
	const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, CONFIG))
	vi.stubGlobal('fetch', fetchMock)

	const sdk = setup()
	await sdk._fetchConfig()

	expect(sdk.config).toEqual(CONFIG)
	expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('normalizes an empty {} response so downstream reads never crash', async () => {
	const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, {}))
	vi.stubGlobal('fetch', fetchMock)

	const sdk = setup()
	await sdk._fetchConfig()

	expect(sdk.config).toEqual({
		name: '',
		version: 0,
		tests: {},
		flags: {},
		audience: {},
	})
})

test('fails fast (no retry) on a 403 with a typed unauthorized error', async () => {
	const fetchMock = vi.fn().mockResolvedValue(makeResponse(403, {}))
	vi.stubGlobal('fetch', fetchMock)

	const sdk = setup()
	await expect(sdk._fetchConfig()).rejects.toMatchObject({
		reason: 'unauthorized',
		status: 403,
	})
	expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('retries a 429 then succeeds', async () => {
	const fetchMock = vi
		.fn()
		.mockResolvedValueOnce(makeResponse(429, { error: 'Too many requests' }))
		.mockResolvedValueOnce(makeResponse(200, CONFIG))
	vi.stubGlobal('fetch', fetchMock)

	const sdk = setup()
	await sdk._fetchConfig()

	expect(sdk.config).toEqual(CONFIG)
	expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('retries 5xx up to the configured limit then throws', async () => {
	const fetchMock = vi.fn().mockResolvedValue(makeResponse(500, {}))
	vi.stubGlobal('fetch', fetchMock)

	const sdk = setup({ configRetries: 2 })
	await expect(sdk._fetchConfig()).rejects.toBeInstanceOf(ImproveFetchError)
	// initial attempt + 2 retries
	expect(fetchMock).toHaveBeenCalledTimes(3)
})

test('configRetries: 0 disables retries', async () => {
	const fetchMock = vi.fn().mockResolvedValue(makeResponse(429, {}))
	vi.stubGlobal('fetch', fetchMock)

	const sdk = setup({ configRetries: 0 })
	await expect(sdk._fetchConfig()).rejects.toMatchObject({
		reason: 'rate-limited',
	})
	expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('forwards configRevalidate as the Next.js next.revalidate option', async () => {
	const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, CONFIG))
	vi.stubGlobal('fetch', fetchMock)

	const sdk = setup({ configRevalidate: 30 })
	await sdk._fetchConfig()

	const [, options] = fetchMock.mock.calls[0]
	expect(options.next).toEqual({ revalidate: 30 })
})

test('omits next when configRevalidate is not set', async () => {
	const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, CONFIG))
	vi.stubGlobal('fetch', fetchMock)

	const sdk = setup()
	await sdk._fetchConfig()

	const [, options] = fetchMock.mock.calls[0]
	expect(options.next).toBeUndefined()
})

test('surfaces the parsed Retry-After delay on the thrown error', async () => {
	const fetchMock = vi
		.fn()
		.mockResolvedValue(makeResponse(429, {}, { 'Retry-After': '2' }))
	vi.stubGlobal('fetch', fetchMock)

	const sdk = setup({ configRetries: 0 })
	await expect(sdk._fetchConfig()).rejects.toMatchObject({
		reason: 'rate-limited',
		retryAfterMs: 2000,
	})
})
