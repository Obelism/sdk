# @obelism/content

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
