import 'server-only'

import { ContentClient, readPreviewParams } from '@obelism/content'

const url = process.env.NEXT_PUBLIC_CONTENT_URL

// Published content, cached by Next and refreshed every minute (or on demand
// from a webhook with revalidateTag('content')).
const delivery = new ContentClient({
	token: process.env.CONTENT_DELIVERY_TOKEN ?? '',
	url,
	init: { next: { revalidate: 60, tags: ['content'] } },
})

// Drafts, for the visual editor. Never cached, never sent to the browser.
const preview = new ContentClient({
	token: process.env.CONTENT_PREVIEW_TOKEN ?? '',
	url,
	init: { cache: 'no-store' },
})

// The client for this request: drafts when the visual editor asks for them.
export const getContent = (
	searchParams: Record<string, string | string[] | undefined>,
) => (readPreviewParams(searchParams) ? preview : delivery)
