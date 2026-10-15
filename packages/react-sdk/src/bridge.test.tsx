import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Entry } from '@obelism/content'
import {
	type BridgeEvent,
	type BridgeEvents,
	type BridgeState,
	INITIAL_STATE,
} from '@obelism/content/bridge'
import {
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
const getContentBridge = vi.fn(() => ({
	isEditing,
	entryId: 'entry_1',
	environment: 'develop',
	on: emitter.on,
	getState: () => state,
	prompt,
	undo: () => {},
	select: () => {},
	destroy: () => {},
}))
vi.mock('@obelism/content/bridge', async (importOriginal) => ({
	...(await importOriginal<object>()),
	getContentBridge: (...args: unknown[]) => getContentBridge(...(args as [])),
}))

const entry = (id: string, title: string): Entry<{ title: string }> => ({
	id,
	contentType: 'page',
	name: title,
	slug: null,
	path: null,
	publishedAt: null,
	firstPublishedAt: null,
	updatedAt: '2026-10-15T00:00:00.000Z',
	fields: { title },
})

const Title = ({ page }: { page: Entry<{ title: string }> }) => {
	const live = useLiveEntry(page)
	return <h1>{live.fields.title}</h1>
}

beforeEach(() => {
	emitter = createEmitter()
	isEditing = true
	state = INITIAL_STATE
	getContentBridge.mockClear()
})
afterEach(cleanup)

describe('useLiveEntry', () => {
	it('shows what the editor sends for the same entry', () => {
		render(<Title page={entry('entry_1', 'Saved')} />)
		expect(screen.getByRole('heading').textContent).toBe('Saved')

		act(() =>
			emitter.emit('update', {
				entry: entry('entry_2', 'Other entry'),
				selectedUid: null,
			}),
		)
		expect(screen.getByRole('heading').textContent).toBe('Saved')

		act(() =>
			emitter.emit('update', {
				entry: entry('entry_1', 'Typing…'),
				selectedUid: null,
			}),
		)
		expect(screen.getByRole('heading').textContent).toBe('Typing…')
	})

	it('drops the live version when the page shows another entry', () => {
		const { rerender } = render(<Title page={entry('entry_1', 'One')} />)
		act(() =>
			emitter.emit('update', {
				entry: entry('entry_1', 'Live'),
				selectedUid: null,
			}),
		)
		rerender(<Title page={entry('entry_3', 'Three')} />)
		expect(screen.getByRole('heading').textContent).toBe('Three')
	})

	it('stops listening when unmounted', () => {
		const { unmount } = render(<Title page={entry('entry_1', 'One')} />)
		expect(emitter.listeners.update.size).toBe(1)
		unmount()
		expect(emitter.listeners.update.size).toBe(0)
	})
})

describe('useContentBridge', () => {
	const State = ({ url }: { url?: string }) => {
		const { isEditing, entryId } = useContentBridge({ url })
		return <p>{isEditing ? `editing ${entryId}` : 'not editing'}</p>
	}

	it('reports the editor after mounting, with the CMS url', () => {
		render(<State url="https://cms.example.com" />)
		expect(screen.getByText('editing entry_1')).toBeTruthy()
		expect(getContentBridge).toHaveBeenCalledWith({
			url: 'https://cms.example.com',
		})
	})

	it('reports nothing outside the editor', () => {
		isEditing = false
		render(<State />)
		expect(screen.getByText('not editing')).toBeTruthy()
	})
})

describe('useContentBridgeEvent', () => {
	it('calls the latest listener', () => {
		const first = vi.fn()
		const second = vi.fn()
		const Listener = ({ onSaved }: { onSaved: () => void }) => {
			useContentBridgeEvent('saved', onSaved)
			return null
		}
		const { rerender } = render(<Listener onSaved={first} />)
		rerender(<Listener onSaved={second} />)

		act(() => emitter.emit('saved', {}))
		expect(first).not.toHaveBeenCalled()
		expect(second).toHaveBeenCalledTimes(1)
		expect(emitter.listeners.saved.size).toBe(1)
	})
})

describe('useContentPrompt', () => {
	const Prompt = () => {
		const { available, prompting, prompt } = useContentPrompt()
		if (!available) return <p>no prompts</p>
		return (
			<button type="button" onClick={() => void prompt('Shorter')}>
				{prompting ? 'working' : 'prompt'}
			</button>
		)
	}

	it('follows the bridge state and prompts through it', () => {
		render(<Prompt />)
		expect(screen.getByText('no prompts')).toBeTruthy()

		act(() => {
			state = { ...state, features: ['prompt'] }
			emitter.emit('change', state)
		})
		act(() => screen.getByRole('button').click())
		expect(prompt).toHaveBeenCalledWith('Shorter')

		act(() => {
			state = { ...state, prompting: true }
			emitter.emit('change', state)
		})
		expect(screen.getByRole('button').textContent).toBe('working')
	})
})
