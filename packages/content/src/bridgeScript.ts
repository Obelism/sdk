import { type ScriptWindow, startScriptBridge } from './bridge/script'

// The entry of dist/bridge.global.js (rollup.bridge.config.mjs): see
// bridge/script.ts.
startScriptBridge(
	window as ScriptWindow,
	document.currentScript as HTMLScriptElement | null,
)
