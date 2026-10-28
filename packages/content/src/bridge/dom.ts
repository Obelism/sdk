// Plain DOM helpers for the bridge's shadow-root UIs (the prompt box, the
// on-site editor).

export const element = <K extends keyof HTMLElementTagNameMap>(
	doc: Document,
	tag: K,
	props: Record<string, string | number | boolean> = {},
	...children: (Node | string)[]
): HTMLElementTagNameMap[K] => {
	const node = doc.createElement(tag)
	Object.assign(node, props)
	// appendChild, not append: Workers types redefine Element.append, and a
	// site's server code may well have them loaded.
	for (const child of children) {
		node.appendChild(
			typeof child === 'string' ? doc.createTextNode(child) : child,
		)
	}
	return node
}

// The obelism marks (U+205C dotted cross, the logo; U+2059 five dot
// punctuation, working), as the design system draws them: filled, on
// currentColor, 24px grid.
export const MARKS = {
	obelism:
		'<rect x="10" y="2" width="4" height="20"/><rect x="2" y="10" width="20" height="4"/><circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/>',
	working:
		'<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="12" r="2.2" class="accent"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/>',
}

// A span with an SVG, hidden from screen readers: a word beside it says
// what it is.
export const svgSpan = (doc: Document, className: string, paths: string) => {
	const span = element(doc, 'span', { className })
	span.setAttribute('aria-hidden', 'true')
	span.innerHTML = `<svg viewBox="0 0 24 24">${paths}</svg>`
	return span
}

// `{name}` style placeholders.
export const fill = (
	template: string,
	values: Record<string, string | number>,
) =>
	template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in values ? String(values[key]) : match,
	)

// Line icons (Lucide), drawn in the text colour.
export const ICONS = {
	page: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
	newPage:
		'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
	block:
		'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 8h10"/><path d="M7 12h6"/>',
	undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
	close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	minimize: '<path d="m6 9 6 6 6-6"/>',
	expand: '<path d="m18 15-6-6-6 6"/>',
	chevrons: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
	search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
	check: '<path d="M20 6 9 17l-5-5"/>',
	mark: `<g fill="currentColor" stroke="none">${MARKS.obelism}</g>`,
	send: '<path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/>',
	arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
	dash: '<path d="M5 12h14"/>',
	eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
	eyeOff:
		'<path d="M10.7 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
	plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
	scope:
		'<rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="3 3"/>',
	alert:
		'<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
}

export const icon = (doc: Document, name: keyof typeof ICONS) =>
	svgSpan(doc, 'icon', ICONS[name])
