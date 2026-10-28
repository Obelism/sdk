import { createSiteEditing, type SiteEnvironment } from '@obelism/content/site'

import { envContext, type Env } from '~/lib/env'

import type { Route } from './+types/cms'

// /cms/login, /cms/callback, /cms/logout and the bridge's /cms/api/… calls.
// Return the handler's Response as it is: it sets several cookies.
const handlerFor = (env: Env) =>
	createSiteEditing({
		spaceId: env.CONTENT_SPACE_ID ?? '',
		environment: (env.CONTENT_ENVIRONMENT ?? 'production') as SiteEnvironment,
	})

export const loader = ({ request, context }: Route.LoaderArgs) =>
	handlerFor(context.get(envContext))(request)

export const action = ({ request, context }: Route.ActionArgs) =>
	handlerFor(context.get(envContext))(request)
