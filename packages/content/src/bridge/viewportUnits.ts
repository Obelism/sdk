// Content's canvas shows a whole page in a frame as tall as the page, so the
// frame is the page's height, not the screen's. Sizes in viewport-height
// units (`vh`, `svh`, `lvh`, `dvh`) would follow it: a `100vh` hero makes
// the page taller, the canvas makes the frame taller, and the hero grows
// again. The editor sends the height the frame stands for (`viewport`), and
// this rewrites those units in the page's stylesheets as pixels of that
// height. Stylesheets from another origin can't be read and keep theirs.

const UNIT = /(-?\d*\.?\d+)(?:s|l|d)?vh\b/g

// A value with its viewport-height units as pixels of `height`, or null when
// it has none.
export const freezeValue = (value: string, height: number) => {
	UNIT.lastIndex = 0
	if (!UNIT.test(value)) return null
	return value.replace(
		UNIT,
		(_, amount: string) =>
			`${Math.round(((Number(amount) * height) / 100) * 100) / 100}px`,
	)
}

const freezeStyle = (style: CSSStyleDeclaration, height: number) => {
	for (let index = 0; index < style.length; index++) {
		const property = style.item(index)
		const frozen = freezeValue(style.getPropertyValue(property), height)
		if (frozen !== null) {
			style.setProperty(property, frozen, style.getPropertyPriority(property))
		}
	}
}

// Style rules, and those inside @media, @supports and @layer blocks.
const freezeRules = (rules: CSSRuleList, height: number) => {
	for (const rule of Array.from(rules)) {
		const { style, cssRules } = rule as CSSRule & {
			style?: CSSStyleDeclaration
			cssRules?: CSSRuleList
		}
		if (style) freezeStyle(style, height)
		if (cssRules) freezeRules(cssRules, height)
	}
}

export type ViewportUnits = {
	// Freezes them at `height`, and in stylesheets added later.
	freeze(height: number): void
	destroy(): void
}

export const createViewportUnits = (doc: Document): ViewportUnits => {
	const done = new WeakSet<CSSStyleSheet>()
	let height: number | null = null
	let observer: MutationObserver | null = null
	let scheduled = false

	const freezeSheets = () => {
		if (height === null) return
		for (const sheet of Array.from(doc.styleSheets)) {
			if (done.has(sheet)) continue
			let rules: CSSRuleList
			try {
				rules = sheet.cssRules
			} catch {
				// Another origin's stylesheet: not ours to read.
				continue
			}
			done.add(sheet)
			freezeRules(rules, height)
		}
		doc.querySelectorAll<HTMLElement>('[style*="vh"]').forEach((element) => {
			freezeStyle(element.style, height!)
		})
	}

	return {
		freeze(next) {
			// Once: the frame stands for one screen size until it reloads.
			if (height !== null || !(next > 0)) return
			height = next
			freezeSheets()
			const View = doc.defaultView?.MutationObserver
			if (!View) return
			// Once per frame, however much the page changes in it.
			observer = new View(() => {
				if (scheduled) return
				scheduled = true
				const run = () => {
					scheduled = false
					freezeSheets()
				}
				if (doc.defaultView?.requestAnimationFrame) {
					doc.defaultView.requestAnimationFrame(run)
				} else run()
			})
			observer.observe(doc.documentElement, { childList: true, subtree: true })
		},
		destroy() {
			observer?.disconnect()
		},
	}
}
