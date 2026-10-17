// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
	readScriptOptions,
	type ScriptWindow,
	startScriptBridge,
} from './script'

const script = (src: string, data: Record<string, string> = {}) => {
	const element = document.createElement('script')
	element.src = src
	Object.assign(element.dataset, data)
	return element
}

describe('readScriptOptions', () => {
	it('talks to the CMS whose /bridge.js it is, as the old script did', () => {
		expect(
			readScriptOptions(script('https://content.obelism.studio/bridge.js')),
		).toEqual({ url: 'https://content.obelism.studio', prompt: true })
		expect(
			readScriptOptions(script('http://localhost:8789/bridge.js')),
		).toEqual({ url: 'http://localhost:8789', prompt: true })
	})

	it('defaults to Obelism Content from a CDN, and takes data-url and data-prompt', () => {
		const cdn =
			'https://cdn.jsdelivr.net/npm/@obelism/content/dist/bridge.global.js'
		expect(readScriptOptions(script(cdn)).url).toBe(
			'https://content.obelism.studio',
		)
		expect(
			readScriptOptions(
				script(cdn, { url: 'https://cms.example', prompt: 'false' }),
			),
		).toEqual({ url: 'https://cms.example', prompt: false })
		expect(readScriptOptions(null)).toEqual({
			url: 'https://content.obelism.studio',
			prompt: true,
		})
	})
})

describe('startScriptBridge', () => {
	it('puts the bridge where the old script did, and the SDK next to it', () => {
		const win = window as ScriptWindow
		const bridge = startScriptBridge(
			win,
			script('https://content.obelism.studio/bridge.js'),
		)
		// Outside the visual editor: inert, like the old script.
		expect(win.ObelismBridge).toBe(bridge)
		expect(bridge.isEditing).toBe(false)
		expect(bridge.entryId).toBeNull()
		expect(typeof bridge.on('update', () => {})).toBe('function')
		expect(win.ObelismContent?.mountPromptBox).toBeTypeOf('function')
	})
})
