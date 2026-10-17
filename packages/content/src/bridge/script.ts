import { getContentBridge, mountPromptBox } from '../bridge'
import { DEFAULT_URL } from '../config'
import type { ContentBridge } from './createBridge'

// The bridge as one script tag, for sites without a bundler. The CMS serves
// this build as its /bridge.js (it replaced a hand-written script); npm CDNs
// serve it from dist/bridge.global.js:
//
//   <script src="https://content.obelism.studio/bridge.js"></script>
//
// It starts the bridge, prompt box included, and puts it on
// `window.ObelismBridge`, which is what the old script offered
// (`isEditing`, `entryId`, `on('update', …)`) and more. Options are data
// attributes on the tag:
//
//   data-url="https://…"   the CMS (default: the origin the script came
//                          from when that is a CMS's /bridge.js, else
//                          content.obelism.studio)
//   data-prompt="false"    no prompt box; mount one later with
//                          ObelismContent.mountPromptBox(document, bridge)

export type ScriptWindow = Window & {
	ObelismBridge?: ContentBridge
	ObelismContent?: {
		getContentBridge: typeof getContentBridge
		mountPromptBox: typeof mountPromptBox
	}
}

// Where the CMS is: `data-url`, else the origin of a CMS's own /bridge.js.
export const readScriptOptions = (script: HTMLScriptElement | null) => {
	const dataUrl = script?.dataset.url
	let url = dataUrl || DEFAULT_URL
	if (!dataUrl && script?.src) {
		const src = new URL(script.src)
		if (src.pathname === '/bridge.js') url = src.origin
	}
	return { url, prompt: script?.dataset.prompt !== 'false' }
}

export const startScriptBridge = (
	win: ScriptWindow,
	script: HTMLScriptElement | null,
) => {
	const bridge = getContentBridge(readScriptOptions(script))
	win.ObelismBridge = bridge
	win.ObelismContent = { getContentBridge, mountPromptBox }
	return bridge
}
