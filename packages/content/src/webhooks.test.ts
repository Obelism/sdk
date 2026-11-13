import { createHmac } from 'node:crypto'

import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import {
	createWebhookHandler,
	verifyWebhook,
	WebhookVerificationError,
	type WebhookEvent,
	type WebhookReleaseEntry,
} from './webhooks'

const key = Buffer.from('a-very-secret-key-of-24b')
const secret = `whsec_${key.toString('base64')}`
const event: WebhookEvent = {
	type: 'entry.published',
	timestamp: '2026-10-13T19:30:00.000Z',
	space: 'space_1',
	environment: 'production',
	data: {
		entry: {
			id: 'entry_1',
			contentType: 'page',
			name: 'Hello',
			path: 'blog/hello',
			paths: { en: 'blog/hello', nl: 'blog/hallo' },
		},
	},
}

// Signed the way the CMS signs webhooks (Standard Webhooks).
const headersFor = ({
	body = JSON.stringify(event),
	timestamp = Math.floor(Date.now() / 1000),
	signingKey = key,
	extraSignature = '',
} = {}) => {
	const id = 'delivery_1'
	const signature = createHmac('sha256', signingKey)
		.update(`${id}.${timestamp}.${body}`)
		.digest('base64')
	return {
		'webhook-id': id,
		'webhook-timestamp': String(timestamp),
		'webhook-signature': `${extraSignature}v1,${signature}`,
	}
}

const signed = (options: Parameters<typeof headersFor>[0] = {}) =>
	new Request('https://site.test/api/revalidate', {
		method: 'POST',
		body: options.body ?? JSON.stringify(event),
		headers: headersFor(options),
	})

describe('verifyWebhook', () => {
	it('returns the event of a request signed with the secret', async () => {
		await expect(verifyWebhook(signed(), secret)).resolves.toEqual(event)
	})

	it('takes a raw body and headers, and one of several signatures', async () => {
		const body = JSON.stringify(event)
		const headers = headersFor({ body, extraSignature: 'v1,bm9wZQ== ' })
		await expect(
			verifyWebhook(
				{
					body,
					// Node's IncomingMessage headers: any case, lists allowed.
					headers: Object.fromEntries(
						Object.entries(headers).map(([name, value]) => [
							name.toUpperCase(),
							value,
						]),
					),
				},
				secret,
			),
		).resolves.toEqual(event)
		await expect(
			verifyWebhook({ body, headers: new Headers(headers) }, secret),
		).resolves.toEqual(event)
	})

	it('refuses other keys, changed bodies, old requests and missing headers', async () => {
		await expect(
			verifyWebhook(signed({ signingKey: Buffer.from('other') }), secret),
		).rejects.toThrow(new WebhookVerificationError('Invalid signature'))
		await expect(
			verifyWebhook(
				{ body: '{"type":"entry.deleted"}', headers: headersFor() },
				secret,
			),
		).rejects.toThrow('Invalid signature')
		await expect(
			verifyWebhook(
				signed({ timestamp: Math.floor(Date.now() / 1000) - 600 }),
				secret,
			),
		).rejects.toThrow('tolerance')
		await expect(
			verifyWebhook(
				new Request('https://x.test', { method: 'POST', body: '{}' }),
				secret,
			),
		).rejects.toThrow(WebhookVerificationError)
		await expect(verifyWebhook(signed(), 'nope')).rejects.toThrow('whsec_')
	})

	it('takes a tolerance', async () => {
		const timestamp = Math.floor(Date.now() / 1000) - 600
		await expect(
			verifyWebhook(signed({ timestamp }), secret, { tolerance: 900 }),
		).resolves.toEqual(event)
		await expect(
			verifyWebhook(signed(), secret, { tolerance: Number.NaN }),
		).rejects.toThrow('tolerance')
	})

	it('refuses a header full of signatures before hashing them', async () => {
		const verify = vi.spyOn(crypto.subtle, 'verify')
		await expect(
			verifyWebhook(signed({ extraSignature: 'v1,AA '.repeat(1000) }), secret),
		).rejects.toThrow('Too many signatures')
		await expect(
			verifyWebhook(signed({ extraSignature: 'v1,AA v1,AA ' }), secret),
		).resolves.toEqual(event)
		// The two short ones are skipped without an HMAC.
		expect(verify).toHaveBeenCalledTimes(1)
		verify.mockRestore()
	})
})

describe('createWebhookHandler', () => {
	it('hands verified events to onEvent and answers 204', async () => {
		const onEvent = vi.fn()
		const response = await createWebhookHandler({ secret, onEvent })(signed())
		expect(response.status).toBe(204)
		expect(onEvent).toHaveBeenCalledWith(event, { id: 'delivery_1' })
	})

	it('answers 401 to unsigned requests and 500 when onEvent throws', async () => {
		const onEvent = vi.fn()
		const handler = createWebhookHandler({ secret, onEvent })
		const unsigned = await handler(signed({ signingKey: Buffer.from('x') }))
		expect(unsigned.status).toBe(401)
		expect(onEvent).not.toHaveBeenCalled()

		vi.spyOn(console, 'error').mockImplementation(() => {})
		const failing = createWebhookHandler({
			secret,
			onEvent: async () => {
				throw new Error('Revalidation failed')
			},
		})
		expect((await failing(signed())).status).toBe(500)
	})
})

describe('WebhookEvent', () => {
	const page = {
		id: 'entry_1',
		contentType: 'page',
		name: 'Hello',
		path: 'blog/hello',
		paths: { en: 'blog/hello' },
	}

	it('narrows release and shared block events on type', async () => {
		const release: WebhookEvent = {
			type: 'release.published',
			timestamp: '2026-11-13T09:00:00.000Z',
			space: 'space_1',
			environment: 'production',
			data: {
				release: { id: 'release_1', name: 'Winter sale' },
				entries: [
					{ ...page, action: 'publish' },
					{ ...page, id: 'entry_2', action: 'unpublish' },
				],
			},
		}
		const verified = await verifyWebhook(
			signed({ body: JSON.stringify(release) }),
			secret,
		)
		expect(verified).toEqual(release)
		if (verified.type === 'release.published') {
			expectTypeOf(verified.data.entries).toEqualTypeOf<WebhookReleaseEntry[]>()
			expectTypeOf(verified.data.release).toEqualTypeOf<{
				id: string
				name: string
			}>()
		}

		const review: WebhookEvent = {
			...release,
			type: 'release.review_requested',
			data: { ...release.data, note: null },
		}
		if (review.type === 'release.review_requested') {
			expectTypeOf(review.data.note).toEqualTypeOf<string | null>()
		}

		const block: WebhookEvent = {
			...release,
			type: 'block.published',
			data: {
				entry: {
					id: 'entry_3',
					contentType: 'hero',
					name: 'Shared hero',
					path: null,
					paths: {},
				},
				entries: [page],
			},
		}
		if (block.type === 'block.published') {
			expectTypeOf(block.data.entries[0]!.paths).toEqualTypeOf<
				Record<string, string>
			>()
		}
	})
})
