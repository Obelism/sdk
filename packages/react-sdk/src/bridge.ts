'use client'

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react'

import {
	type BridgeEvent,
	type BridgeListener,
	type BridgeOptions,
	type BridgeState,
	type ContentBridge as Bridge,
	getContentBridge,
	INITIAL_STATE,
	peekContentBridge,
	type CreatePageResult,
	type PromptResult,
} from '@obelism/content/bridge'
import type { Entry } from '@obelism/content'

export type ContentBridgeProps = BridgeOptions

const noop = () => {}

// The page's bridge, as a React external store: subscribing starts it (after
// mount, never during render), so it is null on the server, while hydrating,
// and until then.
const useBridge = (options: BridgeOptions): Bridge | null => {
	const startWith = useRef(options)
	const { url } = options
	const subscribe = useCallback(
		(onChange: () => void) => {
			getContentBridge({ ...startWith.current, url })
			onChange()
			return noop
		},
		[url],
	)
	return useSyncExternalStore(subscribe, peekContentBridge, () => null)
}

// Starts the visual editor bridge. Put it in the root layout, so clicking a
// block selects it in the editor on every page, also those without
// `useLiveEntry`, and editors get the prompt box (`prompt={false}` leaves it
// out). Renders nothing, and does nothing outside the editor. Its options
// apply when it is the first to start the bridge, which in a root layout it
// is.
export const ContentBridge = ({
	url,
	prompt,
	pagePath,
}: ContentBridgeProps) => {
	useBridge({ url, prompt, pagePath })
	return null
}

export type ContentBridgeState = Pick<
	Bridge,
	'isEditing' | 'mode' | 'entryId' | 'environment'
>

const NOT_EDITING: ContentBridgeState = {
	isEditing: false,
	mode: null,
	entryId: null,
	environment: null,
}

// Whether the page is open in the visual editor (or signed in to edit on the
// site), and on which entry. Always
// "not editing" during server rendering and hydration, so markup matches;
// the real state follows right after.
export const useContentBridge = ({
	url,
}: BridgeOptions = {}): ContentBridgeState => {
	const bridge = useBridge({ url })
	if (!bridge?.isEditing) return NOT_EDITING
	const { isEditing, mode, entryId, environment } = bridge
	return { isEditing, mode, entryId, environment }
}

// Calls `listener` on a bridge event, e.g. to refetch server data once the
// editor saved or published:
//
//   const router = useRouter()
//   useContentBridgeEvent('saved', () => router.refresh())
export const useContentBridgeEvent = <E extends BridgeEvent>(
	event: E,
	listener: BridgeListener<E>,
	{ url }: BridgeOptions = {},
) => {
	const bridge = useBridge({ url })
	const latest = useRef(listener)
	useEffect(() => {
		latest.current = listener
	})
	useEffect(
		() => bridge?.on(event, (payload) => latest.current(payload)),
		[bridge, event],
	)
}

// The entry as the editor has it right now: `entry` itself, until the visual
// editor sends an unsaved version of the same entry, then that — updated as
// the editor types. Outside the editor it is always `entry`.
//
//   'use client'
//   export const Page = ({ entry }: { entry: Entry }) => {
//     const live = useLiveEntry(entry)
//     return <h1>{live.fields.title}</h1>
//   }
export function useLiveEntry<TEntry extends Entry>(
	entry: TEntry,
	options?: BridgeOptions,
): TEntry
export function useLiveEntry<TEntry extends Entry>(
	entry: TEntry | null | undefined,
	options?: BridgeOptions,
): TEntry | null
export function useLiveEntry<TEntry extends Entry>(
	entry: TEntry | null | undefined,
	{ url }: BridgeOptions = {},
): TEntry | null {
	const bridge = useBridge({ url })
	const [live, setLive] = useState<TEntry | null>(null)
	const id = entry?.id

	useEffect(() => {
		if (!id || !bridge) return
		return bridge.on('update', ({ entry: next }) => {
			if (next.id === id) setLive(next as TEntry)
		})
	}, [bridge, id])

	// A live version only stands in for the entry it was sent for.
	if (live && live.id === id) return live
	return entry ?? null
}

export type ContentPromptState = BridgeState & {
	// Prompts are offered here: inside the visual editor or on a site signed
	// in to edit, for someone who may edit content.
	available: boolean
	mode: Bridge['mode']
	// See ContentBridge['prompt'].
	prompt: (
		prompt: string,
		options?: { uid?: string | null },
	) => Promise<PromptResult>
	// See ContentBridge['createPage']: editing on the site, with 'create'.
	createPage: (path: string, prompt: string) => Promise<CreatePageResult>
	undo: () => void
	select: (uid: string | null) => void
	// Editing on the site (see ContentBridge): store the in-memory changes,
	// publish, sign out, and whether clicks select blocks.
	save: () => Promise<void>
	publish: () => Promise<void>
	signOut: () => void
	setSelecting: (selecting: boolean) => void
}

const notStarted = () =>
	Promise.reject(new Error('Prompts only work inside the visual editor'))
const notOnSite = () =>
	Promise.reject(new Error('Only while signed in to edit on the site'))

// For your own prompt UI instead of the built-in box (render
// `<ContentBridge prompt={false} />`):
//
//   const { available, prompting, prompt } = useContentPrompt()
//   if (!available) return null
//   … <button onClick={() => prompt('Make it shorter')}>
export const useContentPrompt = ({
	url,
}: Pick<BridgeOptions, 'url'> = {}): ContentPromptState => {
	const bridge = useBridge({ url })
	const subscribe = useCallback(
		(onChange: () => void) => (bridge ? bridge.on('change', onChange) : noop),
		[bridge],
	)
	const state = useSyncExternalStore(
		subscribe,
		() => bridge?.getState() ?? INITIAL_STATE,
		() => INITIAL_STATE,
	)

	return {
		...state,
		available: state.features.includes('prompt'),
		mode: bridge?.mode ?? null,
		prompt: bridge ? bridge.prompt : notStarted,
		createPage: bridge ? bridge.createPage : notOnSite,
		undo: bridge ? bridge.undo : noop,
		select: bridge ? bridge.select : noop,
		save: bridge ? bridge.save : notOnSite,
		publish: bridge ? bridge.publish : notOnSite,
		signOut: bridge ? bridge.signOut : noop,
		setSelecting: bridge ? bridge.setSelecting : noop,
	}
}
