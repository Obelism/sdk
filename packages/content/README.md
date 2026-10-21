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
await content.getPage('blog/hallo', { locale: 'nl' }) // looked up in nl's paths
await content.findPage('blog/old') //        { entry } | { redirect: { path } } | null
await content.getRedirects({ locale: 'nl' }) // { items: [{ locale, from, to }], total, limit, skip }
for await (const redirect of content.getAllRedirects()) {
}
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
defaults.

Pages and folders can have a slug per locale. `getPage` looks the path up
in the requested locale's paths, `entry.path` is the path in that locale and
`entry.paths` the path in every locale (`{ en: 'about-us', nl: 'over-ons' }`),
for hreflang links and language switchers. The locale is never part of a
path: whether it is `/nl/over-ons` or `nl.example.com/over-ons` is your
routing. A page that moved keeps its old path as a redirect in each locale:
`findPage` answers it with `{ redirect: { path } }`, so your route can send
a `301` instead of a 404, and `getAllRedirects` lists them for redirect rules
built ahead of time. Missing pages and entries are `null`; any other failure throws a
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

`actions` puts controls of your own in the box: an element of your page,
shown next to the closed box and in the open box's footer (by a `<slot>`, so
your CSS styles it). `signOut: false` leaves Sign out out. Content's canvas
uses both for its zoom and screen controls.

```ts
const controls = document.createElement('div')
mountPromptBox(document, bridge, { actions: controls, signOut: false })
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
draft, and the bridge opens it at `/` + its path. The path is the one in
the page's language (`<html lang>`). When your routes put CMS pages
elsewhere, say where:

```ts
getContentBridge({ pagePath: (path, locale) => `/${locale}/${path}` })
await bridge.createPage('/pricing', 'Our plans, for agencies') // or your own UI
```

On a product route, mark the Shopify product the page shows. When the
product has no product page yet (nothing on the page is `editable(entry)`),
the box offers **Add a product page**: the CMS makes a draft of the space's
product page type for it (its handle as slug, in the `products` folder)
and the page reloads, now finding it. The page list opens product pages at the environment's product path (Settings →
Preview URL in the CMS, `/products/{handle}` by default), or at your own
`productPath`:

```tsx
import { editable, editableProduct } from '@obelism/content'

// app/products/[handle]/page.tsx: the store's product, and its page if any.
;<main {...editableProduct(product)} {...editable(productPage)}>
	…
</main>

getContentBridge({ productPath: (handle, locale) => `/${locale}/p/${handle}` })
await bridge.createProductPage() // or your own UI; bridge.product says which
```

A collection route works the same with `editableCollection(collection)`:
**Add a collection page** makes a draft of the space's collection page type
(in the `collections` folder), and the page list opens collection pages at
the environment's collection path (`/collections/{handle}` by default), or
at your own `collectionPath`:

```tsx
import { editable, editableCollection } from '@obelism/content'

;<main {...editableCollection(collection)} {...editable(collectionPage)}>
	…
</main>

await bridge.createCollectionPage() // bridge.collection says which
```

There the box also switches between **Prompt** and **Form**. Form shows the
CMS's own form for the page — or for the entry around the selected block —
right in the box: the fields, and blocks as cards to open and add,
as in the dashboard. Edits apply as you make them: they land in the unsaved
changes, show on the page, and undo a burst of typing at a time. A prompt or
an undo shows in the form too. The form is as tall as it needs to be (up to
60% of the window), and the box can be minimized to its toolbar and footer to
see the page, keeping the form as it is. A chip under the prompt names the page and
opens every page of the space, drafts included, to go to one (at
`pagePath`, in the page's language when it has a path there):

```ts
const form = bridge.openForm(element, { onReady, onError }) // an iframe
form.close()
const pages = await bridge.pages() // { entryId, name, status, path, url }[]
bridge.openPage(pages[0]) // asks first when changes aren't saved
```

The form needs `createSiteEditing`'s `/cms/api/form`, which gets the CMS
page a one-time address. For the raw content instead, as a language model
sees it (one locale, rich text as Markdown, blocks with `_uid` and
`_type`), there is JSON:

```ts
const view = await bridge.view() // or { uid } for a block
const { changed } = await bridge.applyJson({ ...view, title: 'Pricing' })
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
path, paths }`, plus `previousPath` and `previousPaths` when moved), `asset.updated` (`data.asset`,
`data.entries`), `model.changed` (`data.contentTypes`: `{ apiId, action }`),
`locales.changed` (`data.defaultLocale`, `data.locales`),
`entry.review_requested` (`data.entry`, `data.revision`, `data.note`) and
`entry.review_closed` (`data.outcome`: `approved` or `sent_back` with
`data.reason`) for environments whose publishing is reviewed, and
`webhook.test`.

## Click rates

The visual editor can show how often each block is clicked, on the page
itself: a small label on every block with clicks ("24% clicked"), on or off
with the editor's **Show click rates on the page** switch. Clicking a label selects its
block. The rates come from Obelism numbers, so tag a block's clickable
element with its uid and load numbers' script on the site (see the CMS's
visual editor guide, "Click rates"):

```tsx
<a href={block.link} data-numbers-id={block._uid}>
	{block.label}
</a>
```

The bridge draws the labels itself; it needs nothing else from your site.
For your own UI, the rates and the switch are in the bridge's state:

```ts
bridge.on('change', ({ stats, statsVisible }) => …) // stats[uid].rate, 0–1
```

## Helpers

- `richTextToHtml(doc, { renderEntry?, renderAsset? })`, `richTextToPlainText(doc)`
- `imageUrl(asset, { w, h, fit, format, q, focus })`, `imageSrcSet(asset, [480, 960])`:
  with `fit: 'cover'` or `'crop'` the crop keeps the asset's `focalPoint` (set
  in the CMS under Media) in view, or the `focus` you pass (`{ x, y }` or
  `'auto'`)
- `alternateLinks(entry, { url, defaultLocale })`: every locale's URL of a page
  (`entry.paths`), plus `x-default`, for `<link rel="alternate" hreflang>`
- `sitemapXml(entries, { url, defaultLocale, exclude? })`: a sitemap with one
  `<url>` per page and locale and its alternates; pages with "Hide from search
  engines" (`fields.noIndex`) are left out. `url(path, locale)` decides where
  a locale's path lives on your site:

```ts
const pages = []
for await (const page of content.getAllEntries({ contentType: 'page' })) {
	pages.push(page)
}
const xml = sitemapXml(pages, {
	url: (path, locale) => `https://example.com/${locale}/${path}`,
	defaultLocale: 'en',
})
```

## Links

A `link` field goes to a page of the space, to any address, or (with
`products: true`) to a product of the space's Shopify store, each with an optional query and anchor. It is
delivered as `Link`: the page's `id`, `title`, `slug` and `path` (never its
fields), the `url`, or the `product` (`{ id, handle }`) with its product
page as `entry` (`null` when it has none), plus `query` and `hash` without
their `?` and `#`. A link to a page that isn't published is `null`. Where a
page's path lives on your site is your routing, so `linkHref` takes it as
`url` (default `/<path>`), a product's address as `product` (default
`/products/<handle>`), and adds the query and hash:

```tsx
import { linkHref } from '@obelism/content'

;<a
	href={
		linkHref(button.link, {
			url: (path) => `/${locale}/${path}`,
			product: ({ handle }) => `/${locale}/products/${handle}`,
		}) ?? undefined
	}
>
	{button.label}
</a>
```

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

## Shopify

A `shopify` field holds a collection or product of the Shopify store
connected to the space (Settings in Obelism Content), as `ShopifyItem`:
`{ id, handle }`. Content stores only that, so fetch prices, stock and images
live from Shopify's Storefront API with the store's domain and Storefront
token (Settings → Copy as .env):

```ts
import { fetchShopifyCollection } from '@obelism/content'

// A productGrid block: { heading, collection, columns }.
const collection = await fetchShopifyCollection(block.collection, {
	shop: process.env.SHOPIFY_STORE_DOMAIN!,
	storefrontToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
	first: 12,
	country: 'NL', // optional: the market's prices
})

collection?.products.map((product) => ({
	href: `/products/${product.handle}`,
	title: product.title,
	price: product.priceRange.minVariantPrice,
	image: product.featuredImage,
}))
```

A page type with a unique product field is a product page type: one page
per product, for what the store doesn't hold. On your product route, find
the page by the product's id, and render the store's product alone when there
is none:

```ts
const productPage = await content.getFirstEntry({
	contentType: 'productPage',
	fields: { product: product.id }, // gid://shopify/Product/…
})
```

A page type with a unique collection field is a collection page type, found
the same way on your collection route:

```ts
const collectionPage = await content.getFirstEntry({
	contentType: 'collectionPage',
	fields: { collection: collection.id }, // gid://shopify/Collection/…
})
```

`fetchShopifyProducts(items, options)` does the same for a product field
(one item or a list), in the field's order. Both leave out what the store no
longer has. A Hydrogen or Liquid site can use the `id` with its own
Storefront queries instead.

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

Options: `--file`, `--url` (or `$CONTENT_URL`), `--prune`, and for `apply`
`--lock` (the environment's model becomes managed in code: read-only in the
dashboard, the agent API and MCP) or `--unlock`. In GitHub Actions
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
Content type and field descriptions become JSDoc, so editors show them.
Each field is typed by what the delivery API answers with its defaults (one
locale, rich text as a document), and `| null` when empty:

| Field                    | Type                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| text, textarea, datetime | `string`                                                             |
| number / boolean         | `number` / `boolean`                                                 |
| select                   | the options' values, `'a' \| 'b'` (a list when multiple)             |
| asset                    | `Asset` (a list when multiple)                                       |
| reference                | the allowed entry types or their `EntryStub`s (a list when multiple) |
| link                     | `Link`                                                               |
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
