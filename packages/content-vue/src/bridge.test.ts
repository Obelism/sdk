import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Entry } from '@obelism/content'
import {
	type BridgeEvent,
	type BridgeEvents,
	type BridgeState,
	INITIAL_STATE,
} from '@obelism/content/bridge'
import {
	ContentBridge,
	useContentBridge,
	useContentBridgeEvent,
	useContentPrompt,
	useLiveEntry,
} from './bridge'

// A bridge the tests drive by hand, standing in for the editor.
const createEmitter = () => {
	const listeners = {
		update: new Set<(payload: BridgeEvents['update']) => void>(),
		saved: new Set<(payload: BridgeEvents['saved']) => void>(),
		published: new Set<(payload: BridgeEvents['published']) => void>(),
		change: new Set<(payload: BridgeEvents['change']) => void>(),
	}
	type Listener<E extends BridgeEvent> = (payload: BridgeEvents[E]) => void
	return {
		listeners,
		on: <E extends BridgeEvent>(event: E, listener: Listener<E>) => {
			const set = listeners[event] as Set<Listener<E>>
			set.add(listener)
			return () => {
				set.delete(listener)
			}
		},
		emit: <E extends BridgeEvent>(event: E, payload: BridgeEvents[E]) => {
			for (const listener of listeners[event] as Set<Listener<E>>) {
				listener(payload)
			}
		},
	}
}

let emitter: ReturnType<typeof createEmitter>
let isEditing: boolean
let state: BridgeState
const prompt = vi.fn(async () => ({ summary: 'Done' }))
type FakeBridge = ReturnType<typeof makeBridge>
const makeBridge = () => ({
	isEditing,
	entryId: 'entry_1',
	environment: 'develop',
	on: emitter.on,
	getState: () => state,
	mode: 'editor',
	prompt,
	undo: () => {},
	select: () => {},
	destroy: () => {},
})
// One bridge per page, as the real one: started by the first call.
let started: FakeBridge | null = null
const getContentBridge = vi.fn(
	(_options?: unknown) => (started ??= makeBridge()),
)
vi.mock('@obelism/content/bridge', async (importOriginal) => ({
	...(await importOriginal<object>()),
	getContentBridge: (options: unknown) => getContentBridge(options),
	peekContentBridge: () => started,
}))

const entry = (id: string, title: string): Entry<{ title: string }> => ({
	id,
	contentType: 'page',
	name: title,
	slug: null,
	path: null,
	paths: {},
	publishedAt: null,
	firstPublishedAt: null,
	updatedAt: '2026-10-15T00:00:00.000Z',
	fields: { title },
})

const Title = defineComponent({
	props: {
		page: { type: Object as () => Entry<{ title: string }>, required: true },
	},
	setup(props) {
		const live = useLiveEntry(() => props.page)
		return () => h('h1', live.value.fields.title)
	},
})

beforeEach(() => {
	emitter = createEmitter()
	isEditing = true
	state = INITIAL_STATE
	started = null
	getContentBridge.mockClear()
})

describe('useLiveEntry', () => {
	it('shows what the editor sends for the same entry', async () => {
		const wrapper = mount(Title, { props: { page: entry('entry_1', 'Saved') } })
		await nextTick()
		expect(wrapper.text()).toBe('Saved')

		emitter.emit('update', {
			entry: entry('entry_2', 'Other entry'),
			selectedUid: null,
		})
		await nextTick()
		expect(wrapper.text()).toBe('Saved')

		emitter.emit('update', {
			entry: entry('entry_1', 'Typing…'),
			selectedUid: null,
		})
		await nextTick()
		expect(wrapper.text()).toBe('Typing…')
	})

	it('drops the live version when the page shows another entry', async () => {
		const wrapper = mount(Title, { props: { page: entry('entry_1', 'One') } })
		await nextTick()
		emitter.emit('update', {
			entry: entry('entry_1', 'Live'),
			selectedUid: null,
		})
		await wrapper.setProps({ page: entry('entry_3', 'Three') })
		expect(wrapper.text()).toBe('Three')
		expect(emitter.listeners.update.size).toBe(1)
	})

	it('stops listening when unmounted', async () => {
		const wrapper = mount(Title, { props: { page: entry('entry_1', 'One') } })
		await nextTick()
		expect(emitter.listeners.update.size).toBe(1)
		wrapper.unmount()
		expect(emitter.listeners.update.size).toBe(0)
	})
})

describe('useContentBridge', () => {
	const State = defineComponent({
		props: { url: { type: String, default: undefined } },
		setup(props) {
			const bridge = useContentBridge({ url: props.url })
			return () =>
				h(
					'p',
					bridge.value.isEditing
						? `editing ${bridge.value.entryId}`
						: 'not editing',
				)
		},
	})

	it('reports the editor after mounting, with the CMS url', async () => {
		const wrapper = mount(State, { props: { url: 'https://cms.example.com' } })
		await nextTick()
		expect(wrapper.text()).toBe('editing entry_1')
		expect(getContentBridge).toHaveBeenCalledWith({
			url: 'https://cms.example.com',
		})
		expect(getContentBridge).toHaveBeenCalledTimes(1)
	})

	it('reports nothing outside the editor', async () => {
		isEditing = false
		const wrapper = mount(State)
		await nextTick()
		expect(wrapper.text()).toBe('not editing')
	})
})

describe('ContentBridge', () => {
	it('starts the bridge with its options and renders nothing', () => {
		const pagePath = (path: string) => `/site/${path}`
		const wrapper = mount(ContentBridge, {
			props: { url: 'https://cms.example.com', prompt: false, pagePath },
		})
		expect(wrapper.html()).toBe('')
		expect(getContentBridge).toHaveBeenCalledWith({
			url: 'https://cms.example.com',
			prompt: false,
			pagePath,
			productPath: undefined,
			collectionPath: undefined,
		})
	})
})

describe('useContentBridgeEvent', () => {
	it('listens while mounted', async () => {
		const onSaved = vi.fn()
		const Listener = defineComponent({
			setup() {
				useContentBridgeEvent('saved', onSaved)
				return () => null
			},
		})
		const wrapper = mount(Listener)
		await nextTick()
		emitter.emit('saved', {})
		expect(onSaved).toHaveBeenCalledTimes(1)
		wrapper.unmount()
		expect(emitter.listeners.saved.size).toBe(0)
	})
})

describe('useContentPrompt', () => {
	const Prompt = defineComponent({
		setup() {
			const prompt = useContentPrompt()
			return () =>
				prompt.value.available
					? h(
							'button',
							{ onClick: () => void prompt.value.prompt('Shorter') },
							prompt.value.prompting ? 'working' : 'prompt',
						)
					: h('p', 'no prompts')
		},
	})

	it('follows the bridge state and prompts through it', async () => {
		const wrapper = mount(Prompt)
		await nextTick()
		expect(wrapper.text()).toBe('no prompts')

		state = { ...state, features: ['prompt'] }
		emitter.emit('change', state)
		await nextTick()
		await wrapper.get('button').trigger('click')
		expect(prompt).toHaveBeenCalledWith('Shorter')

		state = { ...state, prompting: true }
		emitter.emit('change', state)
		await nextTick()
		expect(wrapper.get('button').text()).toBe('working')
	})
})

describe('outside a component', () => {
	it('starts the bridge straight away', () => {
		const page = ref(entry('entry_1', 'One'))
		const live = useLiveEntry(page)
		emitter.emit('update', {
			entry: entry('entry_1', 'Live'),
			selectedUid: null,
		})
		expect(live.value.fields.title).toBe('Live')
	})
})
