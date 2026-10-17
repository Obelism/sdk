// Webhooks from Obelism Content (the CMS's docs/guides/webhooks): one signed
// POST per event (Standard Webhooks), telling your site what the delivery
// API answers has changed. Verify it and revalidate:
//
//   // app/api/revalidate/route.ts
//   import { revalidatePath } from 'next/cache'
//   import { createWebhookHandler } from '@obelism/content/webhooks'
//
//   export const POST = createWebhookHandler({
//     secret: process.env.CONTENT_WEBHOOK_SECRET!,
//     onEvent: (event) => {
//       if (event.type === 'entry.published' && event.data.entry.path) {
//         revalidatePath(`/${event.data.entry.path}`)
//       }
//     },
//   })

import {
	DEFAULT_TOLERANCE,
	SECRET_PREFIX,
	verifySignature,
} from './standardWebhooks'
import type { Environment } from './types'

// The entry an event is about: enough to know what to revalidate, never its
// content (fetch that from the delivery API). `path` is the default
// locale's and `paths` the path in every locale; null and `{}` for data
// entries.
export type WebhookEntry = {
	id: string
	contentType: string
	name: string
	path: string | null
	paths: Record<string, string>
}

type WebhookEventOf<TType extends string, TData> = {
	type: TType
	// When the event happened (ISO 8601).
	timestamp: string
	space: string
	environment: Environment
	data: TData
}

// An entry is published (first time or again).
export type EntryPublishedEvent = WebhookEventOf<
	'entry.published',
	{ entry: WebhookEntry }
>

// An entry is taken off the delivery API.
export type EntryUnpublishedEvent = WebhookEventOf<
	'entry.unpublished',
	{ entry: WebhookEntry }
>

// A published entry is deleted.
export type EntryDeletedEvent = WebhookEventOf<
	'entry.deleted',
	{ entry: WebhookEntry }
>

// An entry's parent, slug (in any locale) or position changes; everything
// below `previousPath` (per locale: `previousPaths`) moved with it.
export type EntryMovedEvent = WebhookEventOf<
	'entry.moved',
	{
		entry: WebhookEntry
		previousPath: string | null
		previousPaths: Record<string, string>
	}
>

// An asset's alt text or title changes, sent to each environment whose
// content uses it, with up to 100 of those entries (drafts included).
export type AssetUpdatedEvent = WebhookEventOf<
	'asset.updated',
	{ asset: { id: string; filename: string }; entries: WebhookEntry[] }
>

// Content types are created, changed or deleted.
export type ModelChangedEvent = WebhookEventOf<
	'model.changed',
	{
		contentTypes: {
			apiId: string
			action: 'create' | 'update' | 'delete'
		}[]
	}
>

// The space's locales change (sent to every environment).
export type LocalesChangedEvent = WebhookEventOf<
	'locales.changed',
	{ defaultLocale: string; locales: string[] }
>

// **Send test** in Space settings.
export type WebhookTestEvent = WebhookEventOf<
	'webhook.test',
	Record<string, never>
>

export type WebhookEvent =
	| EntryPublishedEvent
	| EntryUnpublishedEvent
	| EntryDeletedEvent
	| EntryMovedEvent
	| AssetUpdatedEvent
	| ModelChangedEvent
	| LocalesChangedEvent
	| WebhookTestEvent

export type WebhookEventType = WebhookEvent['type']

export class WebhookVerificationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'WebhookVerificationError'
	}
}

// The raw body and headers, for frameworks without a fetch Request (Node's
// IncomingMessage headers work as they are). The body must be the exact text
// that was sent, not parsed and stringified again.
export type WebhookMessage = {
	body: string
	headers:
		| Headers
		| Record<string, string | string[] | undefined>
		| Iterable<[string, string]>
}

export type VerifyWebhookOptions = {
	// Seconds the `webhook-timestamp` may be off (default 5 minutes).
	tolerance?: number | undefined
	// For tests: the current time in milliseconds.
	now?: number
}

const headerReader = (headers: WebhookMessage['headers']) => {
	if (typeof (headers as Headers).get === 'function') {
		return (name: string) => (headers as Headers).get(name)
	}
	const lower = new Map<string, string>()
	const entries = Symbol.iterator in headers ? headers : Object.entries(headers)
	for (const [name, value] of entries as Iterable<[string, unknown]>) {
		if (value === undefined) continue
		lower.set(
			name.toLowerCase(),
			Array.isArray(value) ? value.join(' ') : String(value),
		)
	}
	return (name: string) => lower.get(name) ?? null
}

// Checks a webhook's signature and timestamp and returns its event. Throws
// WebhookVerificationError when it isn't from the CMS, or too old.
export const verifyWebhook = async (
	request: Request | WebhookMessage,
	secret: string,
	{
		tolerance = DEFAULT_TOLERANCE,
		now = Date.now(),
	}: VerifyWebhookOptions = {},
): Promise<WebhookEvent> => {
	if (!secret?.startsWith(SECRET_PREFIX)) {
		throw new Error(
			'The webhook secret must be the whsec_… shown when the webhook was added',
		)
	}
	// Not `instanceof Request`: frameworks may bring their own Request class.
	const body =
		typeof request.body === 'string'
			? request.body
			: await (request as Request).text()
	const header = headerReader(request.headers)
	await verifySignature(
		{
			body,
			id: header('webhook-id'),
			timestamp: header('webhook-timestamp'),
			signatures: header('webhook-signature'),
		},
		secret,
		{
			tolerance,
			now,
			fail: (message) => {
				throw new WebhookVerificationError(message)
			},
		},
	)

	let event: WebhookEvent
	try {
		event = JSON.parse(body) as WebhookEvent
	} catch {
		throw new WebhookVerificationError('The body is not JSON')
	}
	if (typeof event?.type !== 'string') {
		throw new WebhookVerificationError('The body is not a webhook event')
	}
	return event
}

export type WebhookHandlerOptions = {
	// The webhook's signing secret (whsec_…).
	secret: string
	// Runs for every verified event. `id` is the delivery's `webhook-id`, the
	// same on every retry: use it to skip one you already handled. Throw to
	// have the CMS try again later.
	onEvent: (event: WebhookEvent, meta: { id: string }) => unknown
	tolerance?: number | undefined
}

// A fetch-style handler (Request → Response) for the webhook's URL: Next.js
// route handlers, Hono, Workers, Bun, Deno. Answers 401 to anything not
// signed by the CMS, 204 once `onEvent` is done and 500 when it throws, so
// the delivery is retried.
export const createWebhookHandler =
	({ secret, onEvent, tolerance }: WebhookHandlerOptions) =>
	async (request: Request): Promise<Response> => {
		let event: WebhookEvent
		try {
			event = await verifyWebhook(request, secret, { tolerance })
		} catch (error) {
			if (error instanceof WebhookVerificationError) {
				return Response.json({ error: error.message }, { status: 401 })
			}
			throw error
		}
		try {
			await onEvent(event, { id: request.headers.get('webhook-id')! })
		} catch (error) {
			console.error('[@obelism/content webhooks]', error)
			return Response.json(
				{ error: 'Handling the event failed' },
				{ status: 500 },
			)
		}
		return new Response(null, { status: 204 })
	}
