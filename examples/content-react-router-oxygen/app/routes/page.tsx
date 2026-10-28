import { data } from 'react-router'

import { ContentPage } from '~/components/content'
import type { PageEntry } from '~/lib/content-types'
import { readContentPage } from '~/lib/content.server'
import { envContext } from '~/lib/env'

import type { Route } from './+types/page'

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const env = context.get(envContext)
	const path = params['*'] ? `pages/${params['*']}` : 'pages'
	const entry = await readContentPage<PageEntry>(
		env,
		request,
		path,
		context.cache,
		context.waitUntil,
	)
	if (!entry) throw data(null, { status: 404 })

	return { entry }
}

export const meta = ({ data }: Route.MetaArgs) => [
	{ title: data?.entry.fields.title ?? '' },
	{
		name: 'description',
		content: data?.entry.fields.seoDescription ?? '',
	},
]

export default function Page({ loaderData }: Route.ComponentProps) {
	return (
		<main className="flex-1" id="main-content" tabIndex={-1}>
			<ContentPage entry={loaderData.entry} />
		</main>
	)
}
