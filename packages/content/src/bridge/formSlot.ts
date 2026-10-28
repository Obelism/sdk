import type { ContentBridge, FormHandle } from './createBridge'

// The CMS's form (`bridge.openForm`) in a container, while shown: a fresh
// one, and one-time address, every time it mounts.
export const createFormSlot = (
	bridge: ContentBridge,
	container: HTMLElement,
	title: string,
	{
		onReady,
		onError,
		onEscape,
	}: {
		onReady: () => void
		onError: (message: string) => void
		onEscape?: (() => void) | undefined
	},
) => {
	let handle: FormHandle | null = null
	let loading = false
	let error: string | null = null
	return {
		get mounted() {
			return handle !== null
		},
		get loading() {
			return loading
		},
		get error() {
			return error
		},
		// Callbacks come later (the address is fetched first), never during
		// the caller's render.
		mount() {
			loading = true
			error = null
			const opened = bridge.openForm(container, {
				title,
				onReady: () => {
					if (handle !== opened) return
					loading = false
					onReady()
				},
				onError: (message) => {
					if (handle !== opened) return
					loading = false
					error = message
					onError(message)
				},
				onEscape: () => {
					if (handle === opened) onEscape?.()
				},
			})
			handle = opened
		},
		unmount() {
			handle?.close()
			handle = null
			loading = false
			error = null
		},
	}
}
