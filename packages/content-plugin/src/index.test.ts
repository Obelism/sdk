import { describe, expect, it } from 'vitest'

import { connect, CONTENT_ORIGIN } from './index'

const init = (origin = CONTENT_ORIGIN) => {
	const channel = new MessageChannel()
	window.dispatchEvent(
		new MessageEvent('message', {
			origin,
			data: { type: 'obelism:init', protocol: 1 },
			ports: [channel.port2],
			source: window.parent,
		}),
	)
	return channel.port1
}

const next = (port: MessagePort) =>
	new Promise<Record<string, unknown>>((resolve) => {
		port.onmessage = ({ data }) => resolve(data)
	})

const CONTEXT = {
	type: 'context',
	location: 'field',
	pluginId: 'brand-colour',
	config: {},
	value: 'red',
	readOnly: false,
	space: { spaceId: 's', name: 'Site' },
	environment: 'develop',
	theme: 'light',
}

describe('connect', () => {
	it('speaks to Content over its port', async () => {
		const connecting = connect({ autoHeight: false })
		const port = init()
		expect(await next(port)).toEqual({ type: 'ready' })
		port.postMessage(CONTEXT)
		const plugin = await connecting
		expect(plugin.context.value).toBe('red')

		const sent = next(port)
		plugin.setValue('blue')
		expect(await sent).toEqual({ type: 'setValue', value: 'blue' })

		const values: unknown[] = []
		plugin.onValue((value) => values.push(value))
		port.postMessage({ type: 'value', value: 'green' })
		await new Promise((resolve) => setTimeout(resolve, 10))
		expect(values).toEqual(['green'])
		expect(plugin.context.value).toBe('green')

		const asked = next(port)
		const token = plugin.token()
		const { id } = (await asked) as { id: string }
		port.postMessage({ type: 'token', id, token: 'jwt', expiresAt: 'later' })
		expect(await token).toEqual({ token: 'jwt', expiresAt: 'later' })
		plugin.disconnect()
	})

	it('ignores an init from another origin', async () => {
		const connecting = connect({ autoHeight: false, timeout: 50 })
		init('https://evil.example.com')
		await expect(connecting).rejects.toThrow('never connected')
	})
})
