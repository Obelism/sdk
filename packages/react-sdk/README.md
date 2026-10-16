# Obelism Content React SDK

```bash
npm i @obelism/content @obelism/content-react
```

## Live preview

```tsx
// app/layout.tsx: starts the bridge, so blocks are selectable on every page
;<ContentBridge />

// A client component rendering an entry
;('use client')
import { editable, useLiveEntry } from '@obelism/content-react'

export const Page = ({ entry }) => {
	const { fields } = useLiveEntry(entry) // the editor's unsaved version while editing
	return fields.body.map((block) => (
		<section key={block._uid} {...editable(block)}>
			…
		</section>
	))
}
```

- `useLiveEntry(entry, { url? })`: `entry`, or the editor's live version of it.
- `useContentBridge()`: `{ isEditing, entryId, environment }`, after hydration.
- `useContentBridgeEvent('saved' | 'published' | 'update', listener)`, e.g.
  `router.refresh()` on publish.
- `<ContentBridge url? prompt? pagePath? />`: pass `url` only when not on content.obelism.studio; `pagePath` maps a CMS path to the site's URL for pages made with New page (default `/` + path).

## Prompt editing

`<ContentBridge />` shows editors a prompt box inside the visual editor (see
`@obelism/content`). `<ContentBridge prompt={false} />` leaves it out;
`useContentPrompt()` gives `{ available, prompting, canUndo, selectedUid,
prompt, createPage, undo, select }` for your own UI.

## Rich text

```tsx
<RichText
	document={entry.fields.body}
	embeddedEntry={({ entry }) => <Card entry={entry} />}
	nodes={{ heading: ({ node, children }) => <h2>{children}</h2> }}
	marks={{
		link: ({ mark, children }) => (
			<Link href={mark.attrs.href}>{children}</Link>
		),
	}}
/>
```

Works in server components too (it isn't a client component).
