export const UID_ATTRIBUTE = 'data-cms-uid'
export const ENTRY_ATTRIBUTE = 'data-cms-entry'

type Editable = { 'data-cms-uid'?: string; 'data-cms-entry'?: string }

// The attribute that lets editors select a block on the page, in the visual
// editor and on the site. Spread it on the block's outermost element:
//
//   <section {...editable(block)}>…</section>
//
// Given an entry, it marks the element the entry renders into, which editing
// on the site (outside the visual editor) needs to know what a prompt, Save
// and Publish act on:
//
//   <main {...editable(entry)}>…</main>
export const editable = (
	target:
		{ _uid?: string } | { id: string; fields: unknown } | null | undefined,
): Editable => {
	if (!target) return {}
	if ('_uid' in target && target._uid) return { 'data-cms-uid': target._uid }
	if ('id' in target && 'fields' in target && target.id) {
		return { 'data-cms-entry': target.id }
	}
	return {}
}
