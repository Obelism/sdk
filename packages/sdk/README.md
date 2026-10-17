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
await content.getFirstEntry({
	contentType: 'navigation',
	fields: { key: 'main' },
}) // Entry | null
await content.getEntries({
	contentType: 'post',
	fields: { category: 'news', 'date[gte]': '2026-01-01', tags: ['a', 'b'] }, // a list: one of them
	order: '-fields.date',
})
await content.getContentModel() //          the model file
```

Each method takes `{ locale, depth, richText, init }` to override the
defaults. Missing pages and entries are `null`; any other failure throws a
`ContentApiError` with `status` and the API's `message`. Type your content
with generics: `content.getPage<Entry<{ title: string }>>('home')`.

## Preview

The visual editor loads your site with
`?cms_preview=1&cms_entry=…&cms_environment=…&cms_token=…`. `cms_token` is
made for the person editing and reads drafts for 8 hours; read the page with
it, server-side. Never show drafts because `cms_preview` is there: anyone can
add it to a URL.

```ts
import {
	ContentApiError,
	ContentClient,
	readPreviewParams,
} from '@obelism/content'

const preview = readPreviewParams(request.url)
const content = preview?.token
	? new ContentClient({ token: preview.token, init: { cache: 'no-store' } })
	: deliveryClient

const page = await content.getPage(path).catch((error) => {
	// A made-up or expired token: show what's published.
	if (error instanceof ContentApiError && error.status === 401) {
		return deliveryClient.getPage(path)
	}
	throw error
})
```

## Visual editor bridge

```ts
import { getContentBridge } from '@obelism/content/bridge'

const bridge = getContentBridge()
bridge.on('update', ({ entry }) => render(entry)) // unsaved edits, as typed
```

Mark blocks so editors can click them: `<section {...editable(block)}>`
(adds `data-cms-uid`). Without an `update` listener the page reloads after
each save. React sites use `@obelism/content-react`.

Without a bundler, the same bridge (prompt box included) is one script tag:

```html
<script src="https://content.obelism.studio/bridge.js"></script>
<script>
	ObelismBridge.on('update', ({ entry }) => render(entry))
</script>
```

The CMS serves this package's `dist/bridge.global.js` there; npm CDNs serve
it too (then add `data-url` if your CMS isn't content.obelism.studio).
`data-prompt="false"` leaves the prompt box out. The tag puts the bridge on
`window.ObelismBridge` and `getContentBridge` / `mountPromptBox` on
`window.ObelismContent`; a bundled copy on the same page shares its bridge.

## Prompt editing

The prompt box is plain DOM in a shadow root, no framework. Start the
bridge with `prompt: false` to leave it out, and mount it yourself later:

```ts
import { getContentBridge, mountPromptBox } from '@obelism/content/bridge'

const bridge = getContentBridge({ prompt: false })
const unmount = mountPromptBox(document, bridge, { labels: { open: 'Ask' } })
```

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

## Webhooks

A webhook tells your site that what the delivery API answers has changed
(Space settings → Webhooks). Its requests are signed (Standard Webhooks);
`createWebhookHandler` verifies them and hands you the typed event:

```ts
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache'
import { createWebhookHandler } from '@obelism/content/webhooks'

export const POST = createWebhookHandler({
	secret: process.env.CONTENT_WEBHOOK_SECRET!, // whsec_…, shown once
	onEvent: (event, { id }) => {
		if (event.type === 'entry.published' && event.data.entry.path) {
			revalidatePath(`/${event.data.entry.path}`)
		} else {
			revalidateTag('content')
		}
	},
})
```

It answers 401 to anything not signed with the secret or with a
`webhook-timestamp` more than 5 minutes off (`tolerance`, in seconds), 204
once `onEvent` is done, and 500 when it throws, so the CMS tries again. `id`
is the delivery's `webhook-id`, the same on every retry.

Elsewhere, `verifyWebhook(request, secret, { tolerance? })` returns the event
or throws `WebhookVerificationError`. It takes a `Request`, or the raw body
and headers (`{ body, headers }`; Node's `req.headers` work as they are), the
body exactly as it was sent:

```ts
import { verifyWebhook } from '@obelism/content/webhooks'

const event = await verifyWebhook(request, process.env.CONTENT_WEBHOOK_SECRET!)
```

`WebhookEvent` is a union on `type`: `entry.published`, `entry.unpublished`,
`entry.deleted` and `entry.moved` (`data.entry`: `{ id, contentType, name,
path }`, plus `previousPath` when moved), `asset.updated` (`data.asset`,
`data.entries`), `model.changed` (`data.contentTypes`: `{ apiId, action }`),
`locales.changed` (`data.defaultLocale`, `data.locales`) and `webhook.test`.

## Helpers

- `richTextToHtml(doc, { renderEntry?, renderAsset? })`, `richTextToPlainText(doc)`
- `imageUrl(asset, { w, h, fit, format, q })`, `imageSrcSet(asset, [480, 960])`

## A/B tests and feature flags

Any blocks field can hold the built-in improve block (`ImproveBlock`,
`_type: '_improve'`): one list of blocks per option of an improve test or
flag. Ask improve's SDK for the visitor's option and render that variant:

```ts
import { isImproveBlock, pickImproveVariant } from '@obelism/content'

// `improve` is improve's SDK (@obelism/improve-sdk), set up for the visitor.
const blocks = layout.flatMap((block) => {
	if (!isImproveBlock(block)) return [block]
	const option =
		block.kind === 'flag'
			? improve.getFlagValue(block.slug)
			: improve.getTestValue(block.slug)
	return pickImproveVariant(block, option)
})
```

`pickImproveVariant(block, option, fallback?)` falls back to `fallback`'s
variant, else the first one, when the option is `null` (the test isn't
active or the visitor isn't in it) or has no variant.

## CLI

Start a site's repository on a space, in its root:

```bash
export CONTENT_MANAGEMENT_TOKEN=cms_m_…   # a management token, Space settings
npx @obelism/content init
```

It writes the model file (`content/content-model.json`), an example of what
the delivery API answers for every content type (`content/examples/`, with
the A/B test or flag block while your organization has improve on),
installs `@obelism/content` with your package manager, and adds the token variables to
`.env.example`. Options: `--dir` (default `content`), `--url`,
`--skip-install`. Agents get the same steps from the CMS's
`getProjectSetup` MCP tool.

Then keep the model file in Git in step with an environment:

```bash
npx @obelism/content model pull    # write content/content-model.json
npx @obelism/content model plan    # what applying would change
npx @obelism/content model apply   # apply it, all or nothing
```

Options: `--file`, `--url` (or `$CONTENT_URL`), `--prune`. In GitHub Actions
the plan is also written to the job summary.

### Types

Write a TypeScript type per content type to `content/content-types.ts`:

```bash
npx @obelism/content types                                    # from the environment
npx @obelism/content types --file content/content-model.json  # from the model file, no token
```

Pages and data become `Entry<{ …fields }, 'apiId'>`, blocks
`Block<{ …fields }, 'apiId'>`, named after the apiId (`blogPost` →
`BlogPost`), with `ContentEntry` and `ContentBlock` as the unions of them.
Each field is typed by what the delivery API answers with its defaults (one
locale, rich text as a document), and `| null` when empty:

| Field                    | Type                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| text, textarea, datetime | `string`                                                             |
| number / boolean         | `number` / `boolean`                                                 |
| select                   | the options' values, `'a' \| 'b'` (a list when multiple)             |
| asset                    | `Asset` (a list when multiple)                                       |
| reference                | the allowed entry types or their `EntryStub`s (a list when multiple) |
| blocks                   | a list of the allowed block types and `ImproveBlock`                 |
| richtext                 | `RichTextDocument`                                                   |
| json                     | `unknown`                                                            |

A localized field is the one locale's value. Pass the types to the client:

```ts
import type { BlogPost } from './content/content-types'

const post = await client.getPage<BlogPost>('blog/hello')
```

Run it again after the model changes, e.g. after `model pull`. Options:
`--dir` (default `content`), `--file`, `--url`.
