import { createHmac } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import { createPromptHandler, verifyPromptRequest } from './prompt'

const key = Buffer.from('a-very-secret-key-of-24b')
const secret = `whsec_${key.toString('base64')}`
const payload = {
	type: 'content.prompt',
	system: 'You edit content',
	messages: [{ role: 'user', content: 'Shorter' }],
	schema: { type: 'object' },
}

// Signed the way the CMS signs (Standard Webhooks).
const signed = ({
	body = JSON.stringify(payload),
	timestamp = Math.floor(Date.now() / 1000),
	signingKey = key,
} = {}) => {
	const id = 'prompt_1'
	const signature = createHmac('sha256', signingKey)
		.update(`${id}.${timestamp}.${body}`)
		.digest('base64')
	return new Request('https://site.test/api/content-prompt', {
		method: 'POST',
		body,
		headers: {
			'webhook-id': id,
			'webhook-timestamp': String(timestamp),
			'webhook-signature': `v1,${signature}`,
		},
	})
}

describe('verifyPromptRequest', () => {
	it('returns the body of a request signed with the secret', async () => {
		await expect(verifyPromptRequest(signed(), secret)).resolves.toEqual(
			payload,
		)
	})

	it('refuses other keys, old requests and missing headers', async () => {
		await expect(
			verifyPromptRequest(signed({ signingKey: Buffer.from('other') }), secret),
		).rejects.toThrow('Invalid signature')
		await expect(
			verifyPromptRequest(
				signed({ timestamp: Math.floor(Date.now() / 1000) - 600 }),
				secret,
			),
		).rejects.toThrow('tolerance')
		await expect(
			verifyPromptRequest(
				new Request('https://x.test', { method: 'POST' }),
				secret,
			),
		).rejects.toThrow('Missing')
		await expect(verifyPromptRequest(signed(), 'nope')).rejects.toThrow(
			'whsec_',
		)
	})
})

describe('createPromptHandler', () => {
	it("answers with the model's output", async () => {
		const generate = vi.fn(async () => ({ changes: {}, summary: 'ok' }))
		const response = await createPromptHandler({ secret, generate })(signed())
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({
			output: { changes: {}, summary: 'ok' },
		})
		expect(generate).toHaveBeenCalledWith(payload)
	})

	it('answers 401 to unsigned requests and 502 when the model fails', async () => {
		const handler = createPromptHandler({
			secret,
			generate: async () => {
				throw new Error('rate limited')
			},
		})
		const unsigned = await handler(signed({ signingKey: Buffer.from('x') }))
		expect(unsigned.status).toBe(401)

		vi.spyOn(console, 'error').mockImplementation(() => {})
		expect((await handler(signed())).status).toBe(502)
	})
})
