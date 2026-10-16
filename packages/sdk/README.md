# Obelism Content JS SDK

```bash
npm i @obelism/content
```

## ContentClient

Reads one space environment through the delivery API. The token decides the
space, the environment and whether drafts are visible: a delivery token
(`cms_d_…`) sees published content, a preview token (`cms_p_…`) drafts too.
Keep preview tokens server-side.

```ts
import { ContentClient } from '@obelism/content'

const content = new ContentClient({
	token: process.env.CONTENT_DELIVERY_TOKEN,
	// url: 'https://content.obelism.studio',
	// locale: 'nl', depth: 1, richText: 'json', timeout: 10_000,
	// init: { next: { revalidate: 60 } },   // passed to every fetch
})

await content.getPage('blog/hello') //       Entry | null
await content.getEntry('entry_…') //         Entry | null
await content.getEntries({ contentType: 'post', limit: 20, skip: 0 }) // { items, total, limit, skip }
for await (const post of content.getAllEntries({ contentType: 'post' })) {
}
await content.getContentModel() //          the model file
```

Each method takes `{ locale, depth, richText, init }` to override the
defaults. Missing pages and entries are `null`; any other failure throws a
`ContentApiError` with `status` and the API's `message`. Type your content
with generics: `content.getPage<Entry<{ title: string }>>('home')`.

## Preview

The visual editor loads your site with `?cms_preview=1&cms_entry=…&cms_environment=…`.

```ts
import { readPreviewParams } from '@obelism/content'

const client = readPreviewParams(request.url) ? previewClient : deliveryClient
```

## Visual editor bridge

```ts
import { getContentBridge } from '@obelism/content/bridge'

const bridge = getContentBridge()
bridge.on('update', ({ entry }) => render(entry)) // unsaved edits, as typed
```

Mark blocks so editors can click them: `<section {...editable(block)}>`
(adds `data-cms-uid`). Without an `update` listener the page reloads after
each save. It replaces the `<script src=".../bridge.js">` tag; when a page has
both, it wraps the script's bridge instead of starting a second one. React
sites use `@obelism/content-react`.

## Prompt editing

Inside the visual editor, people who may edit get a prompt box at the bottom
of the page: they type what to change and it shows on the page right away,
unsaved, with undo. It acts on the selected block, or the whole entry. The
bridge adds it by default; it needs nothing from your site.

```ts
getContentBridge({ prompt: false }) // leave it out
getContentBridge({ prompt: { labels: { open: 'Bewerk met een prompt' } } })

// Your own UI instead:
const bridge = getContentBridge({ prompt: false })
bridge.on('change', ({ features, prompting, canUndo, selectedUid }) => …)
const { summary } = await bridge.prompt('Make the heading shorter')
bridge.undo()
```

On a site signed in to edit (`@obelism/content/site`), the box also has **New
page**: a path (`/pricing`, or under an existing page) and what the page is
for. The CMS writes the page like the one the editor is on and stores it as a
draft, and the bridge opens it at `/` + its path. When your routes put CMS
pages elsewhere, say where:

```ts
getContentBridge({ pagePath: (path) => `/en/${path}` })
await bridge.createPage('/pricing', 'Our plans, for agencies') // or your own UI
```

The CMS runs prompts on Workers AI. To use your own model, set a prompt
endpoint under Space settings → Prompt editing and answer it with
`createPromptHandler` (it verifies the signed request; you call the model):

```ts
// app/api/content-prompt/route.ts
import { createPromptHandler } from '@obelism/content/prompt'

export const POST = createPromptHandler({
	secret: process.env.CONTENT_PROMPT_SECRET, // whsec_… from Space settings
	generate: async ({ system, messages, schema }) => {
		// call any model; return its JSON answer (object or text)
	},
})
```

## Helpers

- `richTextToHtml(doc, { renderEntry?, renderAsset? })`, `richTextToPlainText(doc)`
- `imageUrl(asset, { w, h, fit, format, q })`, `imageSrcSet(asset, [480, 960])`

## CLI

Keeps a content model file in Git in step with an environment.

```bash
export CONTENT_MANAGEMENT_TOKEN=cms_m_…
npx @obelism/content model pull    # write content/content-model.json
npx @obelism/content model plan    # what applying would change
npx @obelism/content model apply   # apply it, all or nothing
```

Options: `--file`, `--url` (or `$CONTENT_URL`), `--prune`. In GitHub Actions
the plan is also written to the job summary.
