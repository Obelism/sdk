// Your own model for prompt editing in the visual editor. Set the endpoint
// under Space settings → Prompt editing; the CMS then sends each prompt there
// instead of to Workers AI, as a signed POST (Standard Webhooks, the same
// scheme as webhooks), with the instructions, the conversation and the JSON
// Schema of the answer already written. Your endpoint only runs a model:
//
//   // app/api/content-prompt/route.ts
//   import { createPromptHandler } from '@obelism/content/prompt'
//
//   export const POST = createPromptHandler({
//     secret: process.env.CONTENT_PROMPT_SECRET,
//     generate: async ({ system, messages, schema }) => {
//       // … call any model; return the answer object (or its JSON text)
//     },
//   })
//
// The CMS checks the answer like any edit, so a bad one changes nothing.

import {
	DEFAULT_TOLERANCE,
	SECRET_PREFIX,
	verifySignature,
} from './standardWebhooks'

export type PromptMessage = { role: 'user' | 'assistant'; content: string }

export type PromptRequest = {
	type: 'content.prompt'
	// Instructions, including the content types involved.
	system: string
	// The editor's request with the current content; on a retry also the
	// previous answer and what was wrong with it.
	messages: PromptMessage[]
	// JSON Schema of the answer: { intent, changes: object, summary: string }.
	schema: Record<string, unknown>
}

export class PromptVerificationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'PromptVerificationError'
	}
}

// Checks a request's Standard Webhooks signature and returns its body.
// Throws PromptVerificationError when it isn't from the CMS.
export const verifyPromptRequest = async (
	request: Request,
	secret: string,
	{ tolerance = DEFAULT_TOLERANCE, now = Date.now() } = {},
): Promise<PromptRequest> => {
	if (!secret?.startsWith(SECRET_PREFIX)) {
		throw new Error('The prompt secret must be the whsec_… from Space settings')
	}
	const body = await request.text()
	await verifySignature(
		{
			body,
			id: request.headers.get('webhook-id'),
			timestamp: request.headers.get('webhook-timestamp'),
			signatures: request.headers.get('webhook-signature'),
		},
		secret,
		{
			tolerance,
			now,
			fail: (message) => {
				throw new PromptVerificationError(message)
			},
		},
	)

	let payload: PromptRequest
	try {
		payload = JSON.parse(body) as PromptRequest
	} catch {
		throw new PromptVerificationError('The body is not JSON')
	}
	if (payload.type !== 'content.prompt') {
		throw new PromptVerificationError(`Unexpected type "${payload.type}"`)
	}
	return payload
}

export type PromptHandlerOptions = {
	// The signing secret shown when the endpoint was set (whsec_…).
	secret: string
	// Runs your model. Return the answer: an object, or JSON text (a Markdown
	// code fence around it is fine).
	generate: (request: PromptRequest) => Promise<unknown>
}

// A fetch-style handler (Request → Response) for the prompt endpoint: Next.js
// route handlers, Hono, Workers, Bun, Deno. Answers 401 to anything not signed
// by the CMS and { output } otherwise.
export const createPromptHandler =
	({ secret, generate }: PromptHandlerOptions) =>
	async (request: Request): Promise<Response> => {
		let payload: PromptRequest
		try {
			payload = await verifyPromptRequest(request, secret)
		} catch (error) {
			if (error instanceof PromptVerificationError) {
				return Response.json({ error: error.message }, { status: 401 })
			}
			throw error
		}
		try {
			return Response.json({ output: await generate(payload) })
		} catch (error) {
			console.error('[@obelism/content prompt]', error)
			return Response.json({ error: 'The model failed' }, { status: 502 })
		}
	}
