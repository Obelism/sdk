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
