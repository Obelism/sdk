import { PREVIEW_PARAMS } from '../preview'
import type { Entry } from '../types'
import {
	type ContentBridge,
	createEmitter,
	createInertBridge,
} from './contract'

// The bridge from the CMS's <script src=".../bridge.js"> tag, if a page has
// both: one bridge per page, so this wraps it instead of starting a second.
// That script predates prompts, so this bridge offers none.
type ScriptBridge = {
	isEditing: boolean
	entryId: string | null
	on: (event: string, listener: (payload: unknown) => void) => void
}

export const wrapScriptBridge = (
	script: ScriptBridge,
	params: URLSearchParams,
): ContentBridge => {
	const emitter = createEmitter()
	script.on('saved', () => emitter.emit('saved', {}))
	script.on('published', () => emitter.emit('published', {}))
	// Only once something listens: bridge.js reloads after a save while it has
	// no `update` listener, and has no way to remove one.
	let forwardingUpdates = false
	return {
		...createInertBridge(),
		isEditing: script.isEditing,
		mode: script.isEditing ? 'editor' : null,
		entryId: script.entryId,
		environment: params.get(PREVIEW_PARAMS.environment),
		on: (event, listener) => {
			if (event === 'update' && !forwardingUpdates) {
				forwardingUpdates = true
				script.on('update', (payload) => {
					const entry = (payload as { entry?: Entry } | null)?.entry
					if (entry) emitter.emit('update', { entry, selectedUid: null })
				})
			}
			return emitter.on(event, listener)
		},
	}
}
