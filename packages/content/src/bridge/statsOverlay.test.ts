// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { blockSelector } from './createBridge'
import { mountStatsOverlay, placeLabel } from './statsOverlay'

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

	it('removes itself when destroyed', () => {
		const overlay = mountStatsOverlay(win(), {
			selector: blockSelector,
			onSelect: () => {},
		})
		overlay.destroy()
		expect(document.querySelector('[data-obelism-stats]')).toBeNull()
	})
})

describe('placeLabel', () => {
	it('puts a block’s label inside its top-right corner', () => {
		expect(placeLabel({ top: 100, right: 900, height: 300 }, 1200)).toEqual({
			place: 'inside',
			top: 108,
			left: 892,
		})
		// A block that starts above the screen keeps its label in view.
		expect(
			placeLabel({ top: -50, right: 900, height: 300 }, 1200),
		).toMatchObject({
			top: 8,
		})
	})

	it('puts a small element’s label beside it, so the label doesn’t cover it', () => {
		expect(placeLabel({ top: 100, right: 300, height: 40 }, 1200)).toEqual({
			place: 'beside',
			top: 120,
			left: 308,
		})
	})

	it('puts it above when there is no room beside it', () => {
		expect(placeLabel({ top: 100, right: 1150, height: 40 }, 1200)).toEqual({
			place: 'above',
			top: 96,
			left: 1150,
		})
	})
})
