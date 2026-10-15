export const UID_ATTRIBUTE = 'data-cms-uid'

// The attribute that lets the visual editor select a block on the page.
// Spread it on the block's outermost element:
//
//   <section {...editable(block)}>…</section>
export const editable = (
	block: { _uid?: string } | null | undefined,
): { 'data-cms-uid'?: string } =>
	block?._uid ? { 'data-cms-uid': block._uid } : {}
