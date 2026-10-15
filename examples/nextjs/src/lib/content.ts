import 'server-only'

import { ContentClient, readPreviewParams } from '@obelism/content'
import { readSiteToken } from '@obelism/content/site'
import { cookies, draftMode } from 'next/headers'

const url = process.env.NEXT_PUBLIC_CONTENT_URL

// Published content, cached by Next and refreshed every minute (or on demand
// from a webhook with revalidateTag('content')).
export const delivery = new ContentClient({
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

// The client for this request: drafts when the visual editor asks for them,
// or in draft mode with the editor's own site token (/cms/login), which
// stops working when they sign out or lose access.
export const getContent = async (
	searchParams: Record<string, string | string[] | undefined>,
) => {
	if (readPreviewParams(searchParams)) return preview
	if ((await draftMode()).isEnabled) {
		const token = readSiteToken(await cookies())
		if (token)
			return new ContentClient({ token, url, init: { cache: 'no-store' } })
	}
	return delivery
}
