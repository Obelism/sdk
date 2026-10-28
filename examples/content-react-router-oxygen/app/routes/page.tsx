import { ContentApiError } from '@obelism/content'
import { type CacheInstance } from '@shopify/hydrogen'
import { data } from 'react-router'

import { ContentPage } from '~/components/content'
import { createContentFor, publishedPage } from '~/lib/content.server'
import type { PageEntry } from '~/lib/content-types'
import { envContext, type Env } from '~/lib/env'

import type { Route } from './+types/page'

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const env = context.get(envContext)
	const path = params['*'] ? `pages/${params['*']}` : 'pages'
	const entry = await readPage(
		env,
		request,
		path,
		context.cache,
		context.waitUntil,
	)
	if (!entry) throw data(null, { status: 404 })

	const headers = new Headers()
	if (hasDraftParams(request)) {
		headers.set('Cache-Control', 'private, no-store')
		headers.set('X-Robots-Tag', 'noindex')
	}
	return data({ entry }, { headers })
}

async function readPage(
	env: Env,
	request: Request,
	path: string,
	cache: CacheInstance,
	waitUntil: ExecutionContext['waitUntil'],
): Promise<PageEntry | null> {
	const client = createContentFor(request, env, cache, waitUntil)
	if (!client) return null
	const read = (c: NonNullable<typeof client>) =>
		c.getPage<PageEntry>(path, { depth: 2 })
	try {
		return await read(client)
	} catch (error) {
		if (error instanceof ContentApiError && error.status === 401) {
			return publishedPage(env, read)
		}
		throw error
	}
}

const hasDraftParams = (request: Request) =>
	new URL(request.url).searchParams.has('cms_token') ||
	request.headers.get('cookie')?.includes('obelism_content_token=') === true

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
