import { type ScriptWindow, startScript } from './script'

// The entry of dist/script.global.js (rollup.script.config.mjs): see
// script.ts.
startScript(
	window as ScriptWindow,
	document.currentScript as HTMLScriptElement | null,
)
