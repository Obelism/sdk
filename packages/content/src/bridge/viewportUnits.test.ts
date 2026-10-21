// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { createViewportUnits, freezeValue } from './viewportUnits'

afterEach(() => {
	document.head.innerHTML = ''
	document.body.innerHTML = ''
})

describe('freezeValue', () => {
	it('turns viewport-height units into pixels of the height', () => {
		expect(freezeValue('100vh', 900)).toBe('900px')
		expect(freezeValue('calc(50svh - 2rem)', 900)).toBe('calc(450px - 2rem)')
		expect(freezeValue('max(80dvh, 30lvh)', 844)).toBe('max(675.2px, 253.2px)')
		expect(freezeValue('.5vh', 1000)).toBe('5px')
	})

	it('leaves other values alone', () => {
		expect(freezeValue('100vw', 900)).toBeNull()
		expect(freezeValue('12px', 900)).toBeNull()
	})
})

describe('createViewportUnits', () => {
	it('freezes stylesheets and inline styles, once', () => {
		const style = document.createElement('style')
		style.textContent = `
			.hero { min-height: 100vh; width: 50vw; }
			@media (min-width: 1px) { .tall { height: 50vh !important; } }
		`
		document.head.appendChild(style)
		document.body.innerHTML = '<div id="inline" style="height: 20vh"></div>'

		const units = createViewportUnits(document)
		units.freeze(900)
		const [hero, media] = Array.from(style.sheet!.cssRules) as [
			CSSStyleRule,
			CSSMediaRule,
		]
		expect(hero.style.getPropertyValue('min-height')).toBe('900px')
		expect(hero.style.getPropertyValue('width')).toBe('50vw')
		const tall = media.cssRules[0] as CSSStyleRule
		expect(tall.style.getPropertyValue('height')).toBe('450px')
		expect(tall.style.getPropertyPriority('height')).toBe('important')
		expect(document.getElementById('inline')!.style.height).toBe('180px')

		// The frame stands for one screen until it reloads.
		units.freeze(400)
		expect(hero.style.getPropertyValue('min-height')).toBe('900px')
		units.destroy()
	})
})
