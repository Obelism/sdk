# @obelism/content

## 0.31.0

### Minor Changes

- c339bcf: `release` previews a release (`release_…`): on the client and per request, sent as the delivery API's `release` parameter. Every read the client makes asks for it, redirects and the content model too, and `readPreviewParams` now answers `cms_release` next to `cms_token`, so a site that forwards it shows the release its Preview button opened rather than every draft. The token must read drafts: a delivery token is refused.

## 0.30.0

### Minor Changes

- f5933bb: `content init` writes `content/examples/_improve.md` beside `_improve.json` while the organization has Improve on: how a site renders a content A/B test before the first paint (Content's docs/adr/0035). Every variant in the page, tagged with `data-ob-imp` and `data-ob-opt`; a classic script and one style rule per test in the head; `seedTestCookies` at the edge; one exposure per test after paint; and the after-load swap for placements below the page type's fold. The same copy as Content's A/B tests guide, with a React example.

  `ImproveBlock` carries `mode?: 'instant' | 'after-load' | null`, which Content stamps when an entry is published, and `fallback` may be `null`, as delivery answers it for an entry published before Content wrote it. `pickImproveVariant`'s `fallback` argument takes `null` too. The `_improve.json` example carries both fields.

- 019cd92: Types for what Content already sends about releases and shared blocks.

  - `WebhookEvent` takes `release.published` and `release.review_requested` (`ReleasePublishedEvent`, `ReleaseReviewRequestedEvent`): `data.release` is `{ id, name }` (`WebhookRelease`) and `data.entries` the release's entries with their `action`, `publish` or `unpublish` (`WebhookReleaseEntry`); a review request adds `data.note`.
  - `WebhookEvent` takes `block.published` (`BlockPublishedEvent`), sent instead of `entry.published` when a shared block is published: `data.entry` is the block and `data.entries` the published pages it updated.
  - `Block` has an optional `_sharedFrom` (`SharedFrom`: `{ id, name, heldAt? }`) on a block that comes from a shared block entry; `heldAt` marks a page's copy held at an earlier publish. Types generated with `content types` get it too.

  ```ts
  if (event.type === 'release.published') {
  	for (const { path } of event.data.entries) {
  		if (path) revalidatePath(`/${path}`)
  	}
  }
  ```

## 0.29.0

### Minor Changes

- 6d46034: `pickImproveVariant` uses the improve block's own `fallback` when the caller names none, and `ImproveBlock` carries `fallback?: string`. Content writes it when an entry is published: it is the option a visitor who isn't in the test or flag sees, which Improve counts as its default and which is not always the first variant in the block.

  ```ts
  // Before: a visitor outside the test got the block's first variant.
  const blocks = pickImproveVariant(block, improve.getTestValue(block.slug))
  ```

  A caller's own `fallback` argument still wins. An entry published before Content wrote the field, or a draft, has none, and the first variant is used as before.

### Patch Changes

- e07ebf9: `ContentClient` asks the delivery API on its token's scoped path (`/api/delivery/v1/{space}/{environment}/…`) once the API has sent it there, skipping the redirect on every later request. Requests for drafts stay on the unscoped path, and a refused scoped request is asked again unscoped.

## 0.28.4

### Patch Changes

- 3ff0881: Internal cleanups, and the shared visitor id:

  - content: the bridge's contract, its two modes and the legacy script bridge are separate modules; a product page and a collection page are one `SHOP` table; the site's `/cms/api` allowlist and the bridge's calls come from one list; the prompt box and the on-site editor work the bridge state out once.
  - improve: one assignment engine for the browser and the server SDKs, so they can't drift on audience, allocation or default values. A visitor id now comes from numbers, as do the cookie names and the `Retry-After` parse; `getLegacyVisitorCookieName()` is new.
  - improve-next: reads the legacy visitor cookie by that name rather than a literal.
  - numbers: exports its visitor id helpers (`createVisitorId`, `isVisitorId`, the `VISITOR_ID_*` constants) and `parseRetryAfterMs`.

## 0.28.3

### Patch Changes

- 45748ea: The on-site editor shows a click rate once its block is selected (or, outside the blocks, its element clicked) instead of every rate at once, and keeps it while the page is open, so a few can be compared.

## 0.28.2

### Patch Changes

- e083770: The on-site editor sends the entries on the page with its click-rate request, so a draft's copy of a live block (with a new uid, the same type and the same links) shows the live block's clicks.

## 0.28.1

### Patch Changes

- fd74098: Every link or button the site tags with `data-numbers-id` gets a little tag on its corner: a cross before its first click, an hourglass while fewer than 20 visitors saw its page, then its click rate. The on-site editor shows them too while blocks are outlined, from the CMS's new `POST /api/site/v1/stats` (`createSiteEditing` forwards `/cms/api/stats`). New labels in `StatsLabels`: `clickedShort`, `noClicks`, `counting`.
- a6d29b6: The on-site editor goes up a level at a time from a nested block: above the form and in the ask view, **Up to {block}** selects the block around it, until **Whole page** goes back to the page. Escape does the same. A new label, `scopeUp`.

## 0.28.0

### Minor Changes

- cb0d745: Links to Shopify collections: `Link`'s `type: 'collection'` (the collection and its collection page), `linkHref`'s `collection` option (default `/collections/<handle>`), and a `link` field's `collections` in `FieldDefinition`. Code that switches on `link.type` exhaustively needs a case for `'collection'`.

## 0.27.2

### Patch Changes

- f9418b3: The on-site editor's form shows which block it edits, with **Whole page** to go back to the page, as the ask view does.

## 0.27.1

### Patch Changes

- f048fa2: The on-site editor opens on **Edit fields**. **Ask** is a small button in the header instead of a pair of tabs, pressed while the ask view shows, and back to the fields on another click (a waiting suggestion is still kept or undone first).

## 0.27.0

### Minor Changes

- c55f5aa: Editing on the site gets the on-site editor (`mountSiteEditor`, which `getContentBridge` mounts there in place of the prompt box): a panel docked on the right with the site reflowed beside it, Ask and Edit fields, the scope always shown, answers with a before and after that preview on the page until kept (Keep it, Try another, Undo), hovered blocks named on the page, and a launcher at the bottom left to minimize, hide the outlines and exit. Its words are `SiteEditorLabels` (`DEFAULT_SITE_EDITOR_LABELS`); a site's fixed elements make room for the panel with the `--obelism-dock` custom property or the `data-obelism-dock` attribute. On the site `bridge.environment` is now the session's, and `getState().undoSteps` says how many steps `undo()` can take back. `openForm` takes `onEscape`, for forms that report Escape. The prompt box's default words follow the redesign: Ask / Edit fields for Prompt / Form, Exit for Exit editing, and “Describe a change, like “make it warmer”” as the placeholder; it draws the Obelism mark as the design system does.
- 4373267: Content types in the model take `groups` (how the editor groups the fields), `accent` and `code` (the type's tile), and fields take `when` (shown only while an earlier field holds a value) and `editor` (a plugin's field editor). All optional. `content model plan` names accent, code, groups and preview image among the settings a change touches.

### Patch Changes

- 6bd5194: The bridge's prompt box and click-rate labels take the redesigned Obelism tokens: warm paper and ink, the new borders and muted text, and Geist in place of Inter.

## 0.26.0

### Minor Changes

- 75bc0ba: `ContentTypeDefinition` has `previewImage`: a block type's picture for the CMS's block picker, an https URL or a media asset id.

## 0.25.0

### Minor Changes

- 3c0733a: Webhook events for the space's Shopify store: `product.updated`, `product.deleted`, `collection.updated` and `collection.deleted`, each with the item, a product's `collections`, the published `entries` that name them and cache `tags`, typed in `WebhookEvent`.

## 0.24.0

### Minor Changes

- 8b2ca58: `Asset.products`: the Shopify products tagged on a file in Obelism media, `[{ id, handle, position }]`, delivered on uses that show them (`products: true`). Exported as `AssetProduct`.

## 0.23.0

### Minor Changes

- 25ef5ae: `ContentClient` takes `drafts`, on the client or per request: with a host token, drafts are read only when asked for (`Obelism-Drafts: true`), so a site's pages and its preview can share one connected deployment. `space` also picks the space of a deployment connected to several; a host token's environment comes from its connection's rule, and naming another `environment` is refused.
- 79af2e7: `token` takes a function too, and `./oidc` has `vercelOidc()` and `githubOidc()`: a deployment on Vercel or in GitHub Actions sends its host's identity token instead of a stored API token, once the deployment is connected to the space. The CLI uses the job's token in GitHub Actions when `CONTENT_MANAGEMENT_TOKEN` isn't set.

### Patch Changes

- 5a8e4c9: The preview docs and the Next.js example pass the site's `space` and `environment` to the client that reads `cms_token`, and `content init` adds `CONTENT_SPACE_ID` and `CONTENT_ENVIRONMENT` to `.env.example`. With Content's delivery API refusing a token for another space than the one a request names, a `cms_token` someone made for their own space can no longer put that space's drafts on your site.
- f1e60ca: `safeReturnTo` resolves `return_to` as a URL and keeps it only when it stays on the site, so `/cms/logout` and the sign-in callback can no longer redirect to another host through a tab or newline (`/%09/evil.test`).
- d7c8181: The site bridge takes the editing cookie's base path only when it is plain path segments, so an injected `obelism_content_editing` cookie such as `/\evil.test` or `/%09/evil.test` can no longer point it at another origin. It only goes to http(s) page addresses, never a `javascript:` URL, and the default `pagePath` drops a leading slash so a page path can't become `//host`.
- 44b7abd: Webhook and prompt verification refuses a `webhook-signature` header with more than 5 signatures and skips any that isn't 32 bytes before computing an HMAC, so an unsigned request can no longer make the endpoint hash its body thousands of times. A `tolerance` of `NaN` now rejects instead of turning the timestamp check off.

## 0.22.0

### Minor Changes

- f00545e: `mountPromptBox(document, bridge, { promptWithoutPage: true })` keeps the prompt where the bridge has no page, with New page beside it, instead of offering only New page. Content's canvas uses it for its prompt for the whole site.

## 0.21.0

### Minor Changes

- 5d60cc4: `mountPromptBox` takes `actions`, an element of your page shown in the box (next to the closed box, and in the open box's footer, through a `<slot>` so your CSS styles it), and `signOut: false` to leave Sign out out. Content's canvas mounts the box with its zoom and screen controls this way. Dragging the box also leaves `<select>`s alone. A new label, `scopeNoPage`, is the scope chip's when there is no page to act on (by default the same as `scopeEntry`).

## 0.20.0

### Minor Changes

- a949269: For Content's canvas, which shows whole pages side by side:

  - The bridge tells the editor the page's height, with `ready` and as a `size` message whenever it changes.
  - On a `viewport` message, it rewrites `vh`, `svh`, `lvh` and `dvh` sizes in the page's stylesheets as pixels of the screen height the frame stands for. Without that, a `100vh` section would grow with a frame that is as tall as the page.
  - The bridge's script tag works in `<head>`: the prompt box mounts once there is a body, instead of the script failing and leaving `window.ObelismBridge` unset.

- a6d3d0e: Collection pages, like product pages (ADR 0022 in Obelism/obelism):

  - `editableCollection(collection)` marks the Shopify collection a page shows.
  - On a collection route without a page, the prompt box offers **Add a collection page**, and `bridge.createCollectionPage()` makes one.
  - `bridge.collection` is the collection the page shows, and each page from `pages()` has a `collection`.
  - The page list opens collection pages at the environment's collection path, or at your own `collectionPath` (an option of `getContentBridge` and `<ContentBridge>`).
  - The site handler passes `POST collection-pages` through to the CMS.

## 0.19.2

### Patch Changes

- 5adae67: Prompt box, Form mode: while the form opens it keeps one height, the form's own, with the spinner in the middle, instead of jumping with what the form reports meanwhile

## 0.19.1

### Patch Changes

- 321f24b: Prompt box: a drag's flick is capped and doesn't count after the pointer stood still, so one coarse pointer event no longer throws the box to the other side

## 0.19.0

### Minor Changes

- f55a2ac: Prompt box: drag it (the pill, or the open box by its bars) to the left or right of the screen, or back to the middle; it springs into place and this browser remembers where

### Patch Changes

- f55a2ac: Form mode: one loading state. With a CMS that says so on `ready`, the prompt box keeps its "Opening the form…" until the form has loaded the entry (`loaded`), instead of then showing the form's own loading text
- f55a2ac: Prompt box: when minimized, clicking any of its buttons other than Minimize and Close expands it again
- f55a2ac: Prompt box: the mark on the pill is drawn, so it sits centred in any font

## 0.18.0

### Minor Changes

- dc6d7b7: Links to Shopify products and product pages: `Link`'s `type: 'product'` (the product and its product page), `linkHref`'s `product` option (default `/products/<handle>`), `editableProduct(product)` to mark the product a page shows, and on a site signed in to edit the prompt box's **Add a product page** (`bridge.product`, `bridge.createProductPage()`), with product pages opened at the environment's product path from the CMS, or `productPath` (also a `ContentBridge` prop). A `shopify` field's `unique` and a `link` field's `products` in `FieldDefinition`. Code that switches on `link.type` exhaustively needs a case for `'product'`.

## 0.17.0

### Minor Changes

- ea5b10b: Link fields: the `link` field type (a page of the space or any address, with an optional query and anchor) in `FieldDefinition`, `content types` (`Link`) and `content init`'s examples, the `Link` and `LinkTarget` types for what delivery answers, and `linkHref(link, { url })` to turn one into an address with your site's routing.
- a949968: Shopify fields: the `shopify` field type (a collection or product of the space's Shopify store, stored as `{ id, handle }`) in `FieldDefinition`, `content types` (`ShopifyItem`) and `content init`'s examples, and `fetchShopifyCollection` / `fetchShopifyProducts` to read prices, stock and images live from the Storefront API.

## 0.16.0

### Minor Changes

- 7df6ab3: The client sends its token as `Obelism-Token` instead of `Authorization: Bearer`, so the delivery API can answer a delivery token from Cloudflare's edge cache (up to 60 seconds, cleared on publish). Needs Content with the edge cache; older Content only reads `Authorization`.

## 0.15.0

### Minor Changes

- 4894e92: Editing on the site: the prompt box can be minimized to its toolbar and footer, so a short page stays in view; the form stays as it is meanwhile. In Form mode the form is as tall as it is (up to 60% of the window) instead of a fixed height, with a CMS that reports it (`height` from `/site/form`).

## 0.14.0

### Minor Changes

- 6146cca: Editing on the site: the prompt box switches between **Prompt** and **Form**, where the JSON editor was. Form shows the CMS's own entry form for the page, or the entry around the selected block, in the box (an iframe), edited live: changes land in the unsaved changes, show on the page and undo a burst of edits at a time, and prompts, undo and a new selection show in the form. The bridge has `openForm(container, { onReady, onError })` for your own UI (the `FormOptions` and `FormHandle` types), and `createSiteEditing` forwards `/cms/api/form`. It needs a CMS with the site API's `form` route (`/api/site/v1/form`) and the `/site/form` page. `bridge.view()` and `bridge.applyJson()` stay, as the raw alternative; the JSON labels left `PromptLabels` (now `form`, `formTitle` and `formLoading`).

## 0.13.0

### Minor Changes

- a41fc26: Editing on the site: the prompt box switches between **Prompt** and **JSON**. JSON shows the page, or the selected block, as the language model sees it, with the unsaved changes, to change by hand or to tweak what a prompt made; applying it is checked like a prompt's answer and undone the same way (Ctrl/Cmd + Enter applies, Enter is a new line). A chip in the box names the page and lists every page of the space, drafts included, with a search, to go to one. The bridge has `view()`, `applyJson()`, `pages()` and `openPage()` for your own UI (the `SitePage` and `ApplyJsonResult` types), and `createSiteEditing` forwards their calls. They need a CMS with the site API's `entries/{id}/view`, `entries/{id}/apply` and `pages` routes.

  `ContentTypeDefinition.description` is a `string` (required in the CMS now; `null` from an older one), and `content types` writes content type and field descriptions as JSDoc, so editors show them on hover.

## 0.12.0

### Minor Changes

- f8339dc: `FieldDefinition` has Content's new field settings: `format` (`url`, `email`, `color` or `slug`) and `unique` on text fields, `pattern` on textareas, `unique` on numbers, `min` and `max` on multiple assets and references, and `defaultValue` on text, textarea, number, boolean and select fields. Typed models (`content model pull`, `content types`) can use them.

## 0.11.0

### Minor Changes

- 8c45c13: `content model apply --lock` marks the environment's content model as managed in code (read-only in the dashboard, the agent API and MCP), and `--unlock` gives it back. The lock is only set when the file applies.

## 0.10.0

### Minor Changes

- 1e35ff3: Webhook types for review before publishing: `entry.review_requested` (`{ entry, revision, note }`) and `entry.review_closed` (`{ entry, outcome: 'approved' | 'sent_back', revision, reason? }`), sent by environments whose publishing is reviewed.

## 0.9.0

### Minor Changes

- be78585: Focal points and sitemaps. `Asset.focalPoint` is the point crops keep in view, and `imageUrl` / `imageSrcSet` pass it as `focus` for `fit: 'cover'` and `'crop'` (or the `focus` you give). `alternateLinks(entry, { url, defaultLocale })` gives every locale's URL of a page for hreflang tags, and `sitemapXml(entries, { url, defaultLocale })` builds a sitemap with alternates per locale.

## 0.8.0

### Minor Changes

- 941af82: Paths per locale. `Entry.paths` holds a page's path in every locale, and `getPage(path, { locale })` looks the path up in that locale. `findPage` answers a moved page with `{ redirect: { path } }`, and `getRedirects` / `getAllRedirects` list the redirects per locale. Webhook entries have `paths`, and `entry.moved` has `previousPaths`. The bridge's `pagePath` gets the page's locale as a second argument.

## 0.7.0

### Minor Changes

- 3b3eb10: The bridge shows click rates on the page in the visual editor: a label on every block with clicks ("24% clicked"), from the editor's new `stats` message, turned on and off by its "Show click rates on the page" switch. Clicking a label selects the block. The rates and the switch are in the bridge's state as `stats` and `statsVisible`; `mountStatsOverlay` and its types are exported from `@obelism/content/bridge`.

## 0.6.0

### Minor Changes

- e362bb5: `@obelism/content/webhooks`: `verifyWebhook` and `createWebhookHandler` verify the CMS's signed webhooks (Standard Webhooks) and hand over the typed `WebhookEvent`. `npx @obelism/content types` writes `content/content-types.ts`, a TypeScript type per content type, from the environment's model (or the model file with `--file`).

## 0.5.0

### Minor Changes

- cc45157: `getEntries` and `getAllEntries` take `fields` (filters on the content type's fields, with `ne`, `in`, `gt`, `gte`, `lt`, `lte` and `exists`; a list means one of them) and `order` (`-publishedAt`, `fields.date`, …). `getFirstEntry` answers the first match or null, to find a settings or navigation entry without its id.

## 0.4.0

### Minor Changes

- 02e896b: `readPreviewParams` also answers `token`: the `cms_token` the visual editor now adds for the person editing, which reads drafts through the delivery API for 8 hours. Read drafts with it rather than with a preview token whenever `cms_preview` is in the URL, which anyone can add. The README and the Next.js example do.

## 0.3.0

### Minor Changes

- 158ed4e: The bridge, prompt box included, as one script tag: `dist/bridge.global.js`, which Obelism Content serves as its `/bridge.js` (`data-prompt="false"`, `data-url`; `window.ObelismBridge` and `window.ObelismContent`). `mountPromptBox` is exported from `@obelism/content/bridge` to mount the prompt box yourself.
- e874570: `content init` starts a site's repository on a space: the model file, an example per content type (with the A/B test or flag block while the organization has improve on), the SDK installed and the token variables in `.env.example`. `ImproveBlock`, `isImproveBlock` and `pickImproveVariant` render the built-in `_improve` block.

## 0.2.0

### Minor Changes

- 419d17d: New page from the prompt box: on a site signed in to edit, editors with the `create` feature give a path and a prompt, the CMS writes the page as a draft (`POST /api/site/v1/entries`, now forwarded by `createSiteEditing`), and the bridge opens it. On a page with no `editable(entry)`, the box only offers New page (and hides Save and Publish). Adds `bridge.createPage()`, the `pagePath` option and `createPage` in `useContentPrompt()`.

## 0.1.1

### Patch Changes

- bb68de1: Redesigned prompt box in the Obelism style: a floating pill with the ⁜ mark when closed, and a rounded card with pill buttons for the scope and undo, an orange send button and, on the site, a footer for saving and publishing.

## 0.1.0

### Minor Changes

- ae6d785: First release.

  - `@obelism/content`: the delivery API client (`ContentClient`), preview helpers, rich text and image helpers, and the `content model` CLI.
  - `@obelism/content/bridge`: the visual editor bridge, with live updates and prompt editing (a prompt box on the page, `bridge.prompt()`).
  - `@obelism/content/prompt`: `createPromptHandler`, for running prompts on your own model.
  - `@obelism/content/site`: editing on your own site (`/cms/login`, draft mode, Save and Publish).
  - `@obelism/content-react`: `ContentBridge`, `useLiveEntry`, `useContentPrompt` and a `RichText` component.
