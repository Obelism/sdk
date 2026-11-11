import {
	computed,
	type ComputedRef,
	defineComponent,
	getCurrentInstance,
	type MaybeRefOrGetter,
	onMounted,
	type PropType,
	type ShallowRef,
	shallowRef,
	toValue,
	watch,
} from 'vue'

import {
	type BridgeEvent,
	type BridgeListener,
	type BridgeOptions,
	type BridgeState,
	type ContentBridge as Bridge,
	type CreatePageResult,
	getContentBridge,
	INITIAL_STATE,
	type PromptResult,
} from '@obelism/content/bridge'
import type { Entry } from '@obelism/content'

export type ContentBridgeProps = BridgeOptions

const noop = () => {}

// Started after mount, never during setup, so it is null on the server and
// while hydrating, and markup matches.
const useBridge = (options: BridgeOptions): ShallowRef<Bridge | null> => {
	const bridge = shallowRef<Bridge | null>(null)
	const start = () => {
		bridge.value = getContentBridge(options)
	}
	if (getCurrentInstance()) onMounted(start)
	else if (typeof window !== 'undefined') start()
	return bridge
}

// Starts the visual editor bridge. Put it in the root (`app.vue` or a
// layout), so clicking a block selects it in the editor on every page, also
// those without `useLiveEntry`, and editors get the prompt box
// (`:prompt="false"` leaves it out). Renders nothing, and does nothing
// outside the editor. Its options apply when it is the first to start the
// bridge, which in the root it is.
export const ContentBridge = defineComponent({
	name: 'ContentBridge',
	props: {
		url: { type: String, default: undefined },
		prompt: {
			type: [Boolean, Object] as PropType<BridgeOptions['prompt']>,
			default: undefined,
		},
		pagePath: {
			type: Function as PropType<BridgeOptions['pagePath']>,
			default: undefined,
		},
		productPath: {
			type: Function as PropType<BridgeOptions['productPath']>,
			default: undefined,
		},
		collectionPath: {
			type: Function as PropType<BridgeOptions['collectionPath']>,
			default: undefined,
		},
	},
	setup(props) {
		useBridge({
			url: props.url,
			prompt: props.prompt,
			pagePath: props.pagePath,
			productPath: props.productPath,
			collectionPath: props.collectionPath,
		})
		return () => null
	},
})

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
// site), and on which entry. Always "not editing" during server rendering
// and hydration; the real state follows right after.
export const useContentBridge = ({
	url,
}: BridgeOptions = {}): ComputedRef<ContentBridgeState> => {
	const bridge = useBridge({ url })
	return computed(() => {
		const current = bridge.value
		if (!current?.isEditing) return NOT_EDITING
		const { isEditing, mode, entryId, environment } = current
		return { isEditing, mode, entryId, environment }
	})
}

// Calls `listener` on a bridge event, e.g. to refetch server data once the
// editor saved or published:
//
//   const { refresh } = await useAsyncData(…)
//   useContentBridgeEvent('saved', () => refresh())
export const useContentBridgeEvent = <E extends BridgeEvent>(
	event: E,
	listener: BridgeListener<E>,
	{ url }: BridgeOptions = {},
) => {
	const bridge = useBridge({ url })
	watch(
		bridge,
		(current, _previous, onCleanup) => {
			if (current) onCleanup(current.on(event, listener))
		},
		{ immediate: true },
	)
}

// The entry as the editor has it right now: `entry` itself, until the visual
// editor sends an unsaved version of the same entry, then that — updated as
// the editor types. Outside the editor it is always `entry`.
//
//   const props = defineProps<{ entry: PageEntry }>()
//   const live = useLiveEntry(() => props.entry)
//   // <h1>{{ live.fields.title }}</h1>
export function useLiveEntry<TEntry extends Entry>(
	entry: MaybeRefOrGetter<TEntry>,
	options?: BridgeOptions,
): ComputedRef<TEntry>
export function useLiveEntry<TEntry extends Entry>(
	entry: MaybeRefOrGetter<TEntry | null | undefined>,
	options?: BridgeOptions,
): ComputedRef<TEntry | null>
export function useLiveEntry<TEntry extends Entry>(
	entry: MaybeRefOrGetter<TEntry | null | undefined>,
	{ url }: BridgeOptions = {},
): ComputedRef<TEntry | null> {
	const bridge = useBridge({ url })
	const live = shallowRef<TEntry | null>(null)
	const id = computed(() => toValue(entry)?.id)

	watch(
		[bridge, id],
		([current, currentId], _previous, onCleanup) => {
			if (!current || !currentId) return
			onCleanup(
				current.on('update', ({ entry: next }) => {
					if (next.id === currentId) live.value = next as TEntry
				}),
			)
		},
		{ immediate: true },
	)

	// A live version only stands in for the entry it was sent for.
	return computed(() => {
		const current = toValue(entry)
		if (live.value && live.value.id === current?.id) return live.value
		return current ?? null
	})
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
// `<ContentBridge :prompt="false" />`):
//
//   const prompt = useContentPrompt()
//   // <button v-if="prompt.available" @click="prompt.prompt('Make it shorter')">
export const useContentPrompt = ({
	url,
}: Pick<BridgeOptions, 'url'> = {}): ComputedRef<ContentPromptState> => {
	const bridge = useBridge({ url })
	const state = shallowRef<BridgeState>(INITIAL_STATE)

	watch(
		bridge,
		(current, _previous, onCleanup) => {
			if (!current) return
			state.value = current.getState()
			onCleanup(
				current.on('change', () => {
					state.value = current.getState()
				}),
			)
		},
		{ immediate: true },
	)

	return computed(() => {
		const current = bridge.value
		return {
			...state.value,
			available: state.value.features.includes('prompt'),
			mode: current?.mode ?? null,
			prompt: current ? current.prompt : notStarted,
			createPage: current ? current.createPage : notOnSite,
			undo: current ? current.undo : noop,
			select: current ? current.select : noop,
			save: current ? current.save : notOnSite,
			publish: current ? current.publish : notOnSite,
			signOut: current ? current.signOut : noop,
			setSelecting: current ? current.setSelecting : noop,
		}
	})
}
