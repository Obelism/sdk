# Obelism Content Vue SDK

Live preview in the visual editor and rich text, for Vue 3 and Nuxt.

```bash
npm i @obelism/content @obelism/content-vue
```

## Live preview

```vue
<!-- app.vue: starts the bridge, so blocks are selectable on every page -->
<template>
	<ContentBridge />
	<NuxtPage />
</template>

<script setup lang="ts">
import { ContentBridge } from '@obelism/content-vue'
</script>
```

```vue
<!-- A component rendering an entry -->
<script setup lang="ts">
import { editable, useLiveEntry } from '@obelism/content-vue'

const props = defineProps<{ entry: PageEntry }>()
// The editor's unsaved version while editing, `entry` everywhere else.
const live = useLiveEntry(() => props.entry)
</script>

<template>
	<main v-bind="editable(live)">
		<section
			v-for="block in live.fields.body"
			:key="block._uid"
			v-bind="editable(block)"
		>
			…
		</section>
	</main>
</template>
```

- `useLiveEntry(entry, { url? })`: a computed ref of `entry` (a ref, getter or
  value), or the editor's live version of it.
- `useContentBridge()`: a computed ref of `{ isEditing, mode, entryId,
environment }`, after mount.
- `useContentBridgeEvent('saved' | 'published' | 'update', listener)`, e.g.
  `refreshNuxtData()` on publish.
- `<ContentBridge url? prompt? page-path? />`: pass `url` only when not on
  content.obelism.studio; `pagePath(path, locale)` maps a CMS path in a locale
  to the site's URL for pages made with New page (default `/` + path).

Call the composables in `setup`. The bridge starts after mount, so server
rendering and hydration always see "not editing".

## Prompt editing

`<ContentBridge />` shows editors a prompt box inside the visual editor (see
`@obelism/content`). `<ContentBridge :prompt="false" />` leaves it out;
`useContentPrompt()` gives a computed ref of `{ available, mode, prompting,
canUndo, selectedUid, prompt, createPage, undo, select, save, publish, signOut,
setSelecting }` for your own UI.

## Rich text

```vue
<RichText
	:document="entry.fields.body"
	:embedded-entry="Card"
	:nodes="{ heading: Heading }"
	:marks="{ link: Link }"
/>
```

Overrides are components: a node or mark override gets `node` or `mark` as a
prop and its rendered children in the default slot, an embed gets `entry` or
`asset` and `node`.

```ts
const Heading: FunctionalComponent<RichTextNodeProps> = (_, { slots }) =>
	h('h2', { class: 'title' }, slots.default?.())
```

Renders on the server too.
