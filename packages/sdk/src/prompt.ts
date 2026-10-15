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

export type PromptMessage = { role: 'user' | 'assistant'; content: string }

export type PromptRequest = {
	type: 'content.prompt'
	// Instructions, including the content types involved.
	system: string
	// The editor's request with the current content; on a retry also the
	// previous answer and what was wrong with it.
	messages: PromptMessage[]
	// JSON Schema of the answer: { changes: object, summary: string }.
	schema: Record<string, unknown>
}

export class PromptVerificationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'PromptVerificationError'
	}
}

const SECRET_PREFIX = 'whsec_'
// Seconds a request's timestamp may be off, against replays.
const DEFAULT_TOLERANCE = 5 * 60

const base64ToBytes = (value: string) =>
	Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

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
	const id = request.headers.get('webhook-id')
	const timestamp = request.headers.get('webhook-timestamp')
	const signatures = request.headers.get('webhook-signature')
	if (!id || !timestamp || !signatures) {
		throw new PromptVerificationError('Missing signature headers')
	}
	const seconds = Number(timestamp)
	if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > tolerance) {
		throw new PromptVerificationError('Timestamp outside the tolerance')
	}

	const body = await request.text()
	const key = await crypto.subtle.importKey(
		'raw',
		base64ToBytes(secret.slice(SECRET_PREFIX.length)),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify'],
	)
	const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`)
	let valid = false
	for (const signature of signatures.split(' ')) {
		const [version, value] = signature.split(',')
		if (version !== 'v1' || !value) continue
		let bytes: Uint8Array<ArrayBuffer>
		try {
			bytes = base64ToBytes(value)
		} catch {
			continue
		}
		// crypto.subtle.verify compares in constant time.
		if (await crypto.subtle.verify('HMAC', key, bytes, signed)) valid = true
	}
	if (!valid) throw new PromptVerificationError('Invalid signature')

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
