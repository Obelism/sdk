// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { blockSelector } from './createBridge'
import {
	mountStatsOverlay,
	placeLabel,
	placeTag,
	statsStatus,
} from './statsOverlay'

const STATS = {
	b_1: { clicks: 37, clickers: 5, viewers: 21, rate: 5 / 21 },
	b_2: { clicks: 3, clickers: 2, viewers: 20, rate: 0.1 },
	b_missing: { clicks: 1, clickers: 1, viewers: 1, rate: 1 },
}

// jsdom lays nothing out, so blocks get a box by hand.
const place = (uid: string, rect: Partial<DOMRect>) => {
	const element = document.querySelector(blockSelector(uid))!
	element.getBoundingClientRect = () =>
		({
			top: 0,
			bottom: 0,
			left: 0,
			right: 0,
			width: 0,
			height: 0,
			...rect,
		}) as DOMRect
}

const badges = () => {
	const host = document.querySelector('[data-obelism-stats]')
	return [
		...(host?.shadowRoot?.querySelectorAll('.badge') ?? []),
	] as HTMLButtonElement[]
}

let frames: (() => void)[]
const win = () =>
	Object.assign(window, {
		requestAnimationFrame: (callback: () => void) => {
			frames.push(callback)
			return frames.length
		},
		cancelAnimationFrame: () => {},
	})
const nextFrame = () => frames.splice(0).forEach((callback) => callback())

beforeEach(() => {
	frames = []
	document.body.innerHTML = `
		<section data-cms-uid="b_1">Hero</section>
		<section data-cms-uid="b_2">Footer</section>
	`
	place('b_1', { top: 100, bottom: 400, right: 900, width: 800, height: 300 })
	place('b_2', { top: 2000, bottom: 2200, right: 900, width: 800, height: 200 })
	Object.defineProperty(window, 'innerHeight', {
		value: 1000,
		configurable: true,
	})
})

afterEach(() => {
	document.querySelector('[data-obelism-stats]')?.remove()
})

describe('mountStatsOverlay', () => {
	it('labels each visible block with its click rate, at its top-right corner', () => {
		const overlay = mountStatsOverlay(win(), {
			selector: blockSelector,
			onSelect: () => {},
		})
		overlay.update(STATS, true)

		// b_2 is below the fold, b_missing isn't on the page.
		expect(badges()).toHaveLength(1)
		const [badge] = badges()
		expect(badge!.textContent).toBe('24% clicked')
		expect(badge!.title).toBe(
			'5 of 21 visitors of its page clicked it in the last 30 days (37 clicks)',
		)
		expect(badge!.style.top).toBe('108px')
		expect(badge!.style.left).toBe('892px')
		overlay.destroy()
	})

	it('shows nothing while switched off, and everything again when on', () => {
		const overlay = mountStatsOverlay(win(), {
			selector: blockSelector,
			onSelect: () => {},
		})
		overlay.update(STATS, false)
		expect(badges()).toHaveLength(0)
		overlay.update(STATS, true)
		expect(badges()).toHaveLength(1)
		overlay.destroy()
	})

	it('follows the blocks when the page scrolls, once a frame', () => {
		const overlay = mountStatsOverlay(win(), {
			selector: blockSelector,
			onSelect: () => {},
		})
		overlay.update(STATS, true)

		place('b_1', {
			top: -500,
			bottom: -200,
			right: 900,
			width: 800,
			height: 300,
		})
		place('b_2', { top: 300, bottom: 500, right: 900, width: 800, height: 200 })
		window.dispatchEvent(new Event('scroll'))
		window.dispatchEvent(new Event('scroll'))
		expect(frames).toHaveLength(1)
		nextFrame()

		expect(badges().map((badge) => badge.dataset.uid)).toEqual(['b_2'])
		expect(badges()[0]!.textContent).toBe('10% clicked')
		overlay.destroy()
	})

	it('selects the block when its label is clicked', () => {
		const onSelect = vi.fn()
		const overlay = mountStatsOverlay(win(), {
			selector: blockSelector,
			onSelect,
		})
		overlay.update(STATS, true)
		badges()[0]!.click()
		expect(onSelect).toHaveBeenCalledWith('b_1')
		overlay.destroy()
	})

	it('takes its own labels', () => {
		const overlay = mountStatsOverlay(win(), {
			selector: blockSelector,
			onSelect: () => {},
			labels: { clicked: '{rate}% geklikt' },
		})
		overlay.update(STATS, true)
		expect(badges()[0]!.textContent).toBe('24% geklikt')
		overlay.destroy()
	})

	it('tags the links the page tags: a cross before a click, an hourglass before a rate', () => {
		document.body.insertAdjacentHTML(
			'beforeend',
			`<section data-cms-uid="b_3"><a data-numbers-id="b_3">Few</a></section>
			<a data-numbers-id="b_4">None</a><a data-numbers-id="b_5">Unasked</a>`,
		)
		for (const id of ['b_3', 'b_4', 'b_5']) {
			const element = document.querySelector(`[data-numbers-id="${id}"]`)!
			element.getBoundingClientRect = () =>
				({
					top: 500,
					bottom: 540,
					right: 300,
					width: 120,
					height: 40,
				}) as DOMRect
		}
		const onSelect = vi.fn()
		const overlay = mountStatsOverlay(win(), {
			selector: blockSelector,
			onSelect,
			checked: (id) => id === 'b_3' || id === 'b_4',
		})
		overlay.update(
			{ ...STATS, b_3: { clicks: 2, clickers: 2, viewers: 5, rate: 0.4 } },
			true,
		)

		const tags = Object.fromEntries(
			badges()
				.concat([
					...document
						.querySelector('[data-obelism-stats]')!
						.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tag'),
				])
				.map((tag) => [tag.dataset.uid, tag]),
		)
		expect(Object.keys(tags).sort()).toEqual(['b_1', 'b_3', 'b_4'])
		expect(tags.b_1!.dataset.status).toBe('rate')
		expect(tags.b_3!.dataset.status).toBe('counting')
		expect(tags.b_3!.getAttribute('aria-label')).toBe(
			'2 clicks so far: a click rate once 20 visitors saw its page (5 yet)',
		)
		expect(tags.b_4!.dataset.status).toBe('none')
		expect(tags.b_4!.title).toBe('No clicks yet in the last 30 days')
		expect(tags.b_4!.style.top).toBe('500px')
		expect(tags.b_4!.style.left).toBe('300px')

		tags.b_3!.click()
		expect(onSelect).toHaveBeenLastCalledWith('b_3')
		// Not a block, nor in one: nothing to select.
		tags.b_4!.click()
		expect(onSelect).toHaveBeenCalledTimes(1)
		overlay.destroy()
	})

	it('tags every tagged element, and by default only the ids of the page’s blocks', () => {
		document.body.innerHTML = `
			<section data-cms-uid="b_1"><a data-numbers-id="b_1">One</a><a data-numbers-id="b_1">Two</a></section>
			<a data-numbers-id="not_a_block">Elsewhere</a>`
		for (const element of document.querySelectorAll('[data-numbers-id]'))
			element.getBoundingClientRect = () =>
				({
					top: 500,
					bottom: 540,
					right: 300,
					width: 120,
					height: 40,
				}) as DOMRect
		const overlay = mountStatsOverlay(win(), {
			selector: blockSelector,
			onSelect: () => {},
		})
		overlay.update({}, true)
		const tags = [
			...document
				.querySelector('[data-obelism-stats]')!
				.shadowRoot!.querySelectorAll<HTMLElement>('.tag'),
		]
		expect(tags.map((tag) => [tag.dataset.uid, tag.dataset.status])).toEqual([
			['b_1', 'none'],
			['b_1', 'none'],
		])
		overlay.destroy()
	})

	it('removes itself when destroyed', () => {
		const overlay = mountStatsOverlay(win(), {
			selector: blockSelector,
			onSelect: () => {},
		})
		overlay.destroy()
		expect(document.querySelector('[data-obelism-stats]')).toBeNull()
	})
})

describe('statsStatus', () => {
	it('needs a click, then enough visitors, for a rate', () => {
		expect(statsStatus(undefined)).toBe('none')
		expect(
			statsStatus({ clicks: 1, clickers: 1, viewers: 19, rate: 0.05 }),
		).toBe('counting')
		expect(
			statsStatus({ clicks: 1, clickers: 1, viewers: 20, rate: 0.05 }),
		).toBe('rate')
	})
})

describe('placeLabel', () => {
	it('puts a block’s label inside its top-right corner, in view', () => {
		expect(placeLabel({ top: 100, right: 900 })).toEqual({
			top: 108,
			left: 892,
		})
		expect(placeLabel({ top: -50, right: 900 })).toEqual({ top: 8, left: 892 })
	})
})

describe('placeTag', () => {
	it('puts a link’s tag on its corner, kept on screen', () => {
		const viewport = { width: 1200, height: 800 }
		expect(placeTag({ top: 100, right: 300 }, viewport)).toEqual({
			top: 100,
			left: 300,
		})
		expect(placeTag({ top: -20, right: 1300 }, viewport)).toEqual({
			top: 10,
			left: 1190,
		})
		expect(placeTag({ top: 900, right: 300 }, viewport).top).toBe(790)
	})
})
