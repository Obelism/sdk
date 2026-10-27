import { createRemoteJWKSet, jwtVerify } from 'jose'

import { CONTENT_ORIGIN } from './index'

export const PLUGIN_TOKEN_TYPE = 'obelism-plugin+jwt'

export type ContextTokenClaims = {
	pluginId: string
	userId: string
	organizationId: string
	spaceId: string
	environment: string
	role: string
	// With the `entry:read` permission.
	entry?: { id: string; contentType: string | null }
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

// Verifies a context token a plugin's frame handed its backend: signed by
// Content (its JWKS at /.well-known/plugin-jwks.json), for this plugin, not
// expired. Throws when it isn't.
export const verifyContextToken = async (
	token: string,
	{ pluginId, origin = CONTENT_ORIGIN }: { pluginId: string; origin?: string },
): Promise<ContextTokenClaims> => {
	let keys = keySets.get(origin)
	if (!keys) {
		keys = createRemoteJWKSet(new URL('/.well-known/plugin-jwks.json', origin))
		keySets.set(origin, keys)
	}
	const { payload } = await jwtVerify(token, keys, {
		algorithms: ['ES256'],
		typ: PLUGIN_TOKEN_TYPE,
		issuer: origin,
		audience: pluginId,
	})
	const claims = payload as typeof payload & {
		org: string
		space: string
		env: string
		role: string
		entry?: { id: string; contentType: string | null }
	}
	return {
		pluginId,
		userId: String(claims.sub),
		organizationId: claims.org,
		spaceId: claims.space,
		environment: claims.env,
		role: claims.role,
		...(claims.entry && { entry: claims.entry }),
	}
}
