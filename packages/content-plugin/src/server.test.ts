import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PLUGIN_TOKEN_TYPE, verifyContextToken } from './server'

const origin = 'https://content.test'

const setup = async () => {
	const { publicKey, privateKey } = await generateKeyPair('ES256')
	const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' }
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => Response.json({ keys: [jwk] })),
	)
	const sign = (claims: Record<string, unknown>, audience = 'brand-colour') =>
		new SignJWT(claims)
			.setProtectedHeader({ alg: 'ES256', kid: 'k1', typ: PLUGIN_TOKEN_TYPE })
			.setIssuer(origin)
			.setAudience(audience)
			.setSubject('user_1')
			.setExpirationTime('5m')
			.sign(privateKey)
	return sign
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('verifyContextToken', () => {
	it('reads a token Content signed for this plugin', async () => {
		const sign = await setup()
		const token = await sign({
			org: 'org_1',
			space: 'space_1',
			env: 'develop',
			role: 'editor',
			entry: { id: 'entry_1', contentType: 'page' },
		})
		expect(
			await verifyContextToken(token, { pluginId: 'brand-colour', origin }),
		).toEqual({
			pluginId: 'brand-colour',
			userId: 'user_1',
			organizationId: 'org_1',
			spaceId: 'space_1',
			environment: 'develop',
			role: 'editor',
			entry: { id: 'entry_1', contentType: 'page' },
		})
	})

	it("refuses another plugin's token", async () => {
		const sign = await setup()
		const token = await sign(
			{ org: 'o', space: 's', env: 'develop', role: 'editor' },
			'other',
		)
		await expect(
			verifyContextToken(token, {
				pluginId: 'brand-colour',
				origin: 'https://content2.test',
			}),
		).rejects.toThrow()
	})
})
