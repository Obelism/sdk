import { ContentApiError } from '@obelism/content'
import { notFound } from 'next/navigation'

import { Page, type PageEntry } from '@/components/Page'
import { delivery, getContent } from '@/lib/content'

type Props = {
	params: Promise<{ slug?: string[] }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Every page entry, by path. `/` shows the entry at `home`.
export default async function CatchAll({ params, searchParams }: Props) {
	const { slug } = await params
	const path = slug?.join('/') || 'home'
	const content = await getContent(await searchParams)

	const entry = await content
		.getPage<PageEntry>(path, { depth: 2 })
		.catch((error: unknown) => {
			// A visual editor or site token that expired or was revoked: show
			// what's published until the editor opens the page again.
			if (error instanceof ContentApiError && error.status === 401) {
				// Says why, when the canvas shows published content.
				console.warn('Content refused the draft token:', error.body)
				return delivery.getPage<PageEntry>(path, { depth: 2 })
			}
			throw error
		})
	if (!entry) notFound()

	return <Page entry={entry} />
}
