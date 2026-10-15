import { notFound } from 'next/navigation'

import { Page, type PageEntry } from '@/components/Page'
import { getContent } from '@/lib/content'

type Props = {
	params: Promise<{ slug?: string[] }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Every page entry, by path. `/` shows the entry at `home`.
export default async function CatchAll({ params, searchParams }: Props) {
	const { slug } = await params
	const content = getContent(await searchParams)

	const entry = await content.getPage<PageEntry>(slug?.join('/') || 'home', {
		depth: 2,
	})
	if (!entry) notFound()

	return <Page entry={entry} />
}
