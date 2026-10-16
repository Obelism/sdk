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

// Drafts with a token of the person editing, never cached.
const drafts = (token: string) =>
	new ContentClient({ token, url, init: { cache: 'no-store' } })

// The client for this request: drafts in the visual editor, with the token it
// adds to the URL for the person editing (`cms_token`; `cms_preview` alone
// proves nothing, anyone can add it), or in draft mode with the editor's own
// site token (/cms/login). Both stop working when the person loses access or
// the token expires; the page then falls back to `delivery`.
export const getContent = async (
	searchParams: Record<string, string | string[] | undefined>,
) => {
	const preview = readPreviewParams(searchParams)
	if (preview?.token) return drafts(preview.token)
	if ((await draftMode()).isEnabled) {
		const token = readSiteToken(await cookies())
		if (token) return drafts(token)
	}
	return delivery
}
