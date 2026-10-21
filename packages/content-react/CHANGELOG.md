# @obelism/content-react

## 0.4.1

### Patch Changes

- Updated dependencies [5d60cc4]
  - @obelism/content@0.21.0

## 0.4.0

### Minor Changes

- a6d3d0e: Collection pages, like product pages (ADR 0022 in Obelism/obelism):

  - `editableCollection(collection)` marks the Shopify collection a page shows.
  - On a collection route without a page, the prompt box offers **Add a collection page**, and `bridge.createCollectionPage()` makes one.
  - `bridge.collection` is the collection the page shows, and each page from `pages()` has a `collection`.
  - The page list opens collection pages at the environment's collection path, or at your own `collectionPath` (an option of `getContentBridge` and `<ContentBridge>`).
  - The site handler passes `POST collection-pages` through to the CMS.

### Patch Changes

- Updated dependencies [a949269]
- Updated dependencies [a6d3d0e]
  - @obelism/content@0.20.0

## 0.3.1

### Patch Changes

- Updated dependencies [f55a2ac]
- Updated dependencies [f55a2ac]
- Updated dependencies [f55a2ac]
- Updated dependencies [f55a2ac]
  - @obelism/content@0.19.0

## 0.3.0

### Minor Changes

- dc6d7b7: Links to Shopify products and product pages: `Link`'s `type: 'product'` (the product and its product page), `linkHref`'s `product` option (default `/products/<handle>`), `editableProduct(product)` to mark the product a page shows, and on a site signed in to edit the prompt box's **Add a product page** (`bridge.product`, `bridge.createProductPage()`), with product pages opened at the environment's product path from the CMS, or `productPath` (also a `ContentBridge` prop). A `shopify` field's `unique` and a `link` field's `products` in `FieldDefinition`. Code that switches on `link.type` exhaustively needs a case for `'product'`.

### Patch Changes

- Updated dependencies [dc6d7b7]
  - @obelism/content@0.18.0

## 0.2.15

### Patch Changes

- Updated dependencies [ea5b10b]
- Updated dependencies [a949968]
  - @obelism/content@0.17.0

## 0.2.14

### Patch Changes

- Updated dependencies [7df6ab3]
  - @obelism/content@0.16.0

## 0.2.13

### Patch Changes

- Updated dependencies [4894e92]
  - @obelism/content@0.15.0

## 0.2.12

### Patch Changes

- Updated dependencies [6146cca]
  - @obelism/content@0.14.0

## 0.2.11

### Patch Changes

- Updated dependencies [a41fc26]
  - @obelism/content@0.13.0

## 0.2.10

### Patch Changes

- Updated dependencies [f8339dc]
  - @obelism/content@0.12.0

## 0.2.9

### Patch Changes

- Updated dependencies [8c45c13]
  - @obelism/content@0.11.0

## 0.2.8

### Patch Changes

- Updated dependencies [1e35ff3]
  - @obelism/content@0.10.0

## 0.2.7

### Patch Changes

- Updated dependencies [be78585]
  - @obelism/content@0.9.0

## 0.2.6

### Patch Changes

- 941af82: Paths per locale. `Entry.paths` holds a page's path in every locale, and `getPage(path, { locale })` looks the path up in that locale. `findPage` answers a moved page with `{ redirect: { path } }`, and `getRedirects` / `getAllRedirects` list the redirects per locale. Webhook entries have `paths`, and `entry.moved` has `previousPaths`. The bridge's `pagePath` gets the page's locale as a second argument.
- Updated dependencies [941af82]
  - @obelism/content@0.8.0

## 0.2.5

### Patch Changes

- Updated dependencies [3b3eb10]
  - @obelism/content@0.7.0

## 0.2.4

### Patch Changes

- Updated dependencies [e362bb5]
  - @obelism/content@0.6.0

## 0.2.3

### Patch Changes

- Updated dependencies [cc45157]
  - @obelism/content@0.5.0

## 0.2.2

### Patch Changes

- Updated dependencies [02e896b]
  - @obelism/content@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [158ed4e]
- Updated dependencies [e874570]
  - @obelism/content@0.3.0

## 0.2.0

### Minor Changes

- 419d17d: New page from the prompt box: on a site signed in to edit, editors with the `create` feature give a path and a prompt, the CMS writes the page as a draft (`POST /api/site/v1/entries`, now forwarded by `createSiteEditing`), and the bridge opens it. On a page with no `editable(entry)`, the box only offers New page (and hides Save and Publish). Adds `bridge.createPage()`, the `pagePath` option and `createPage` in `useContentPrompt()`.

### Patch Changes

- Updated dependencies [419d17d]
  - @obelism/content@0.2.0

## 0.1.0

### Minor Changes

- ae6d785: First release.

  - `@obelism/content`: the delivery API client (`ContentClient`), preview helpers, rich text and image helpers, and the `content model` CLI.
  - `@obelism/content/bridge`: the visual editor bridge, with live updates and prompt editing (a prompt box on the page, `bridge.prompt()`).
  - `@obelism/content/prompt`: `createPromptHandler`, for running prompts on your own model.
  - `@obelism/content/site`: editing on your own site (`/cms/login`, draft mode, Save and Publish).
  - `@obelism/content-react`: `ContentBridge`, `useLiveEntry`, `useContentPrompt` and a `RichText` component.

### Patch Changes

- Updated dependencies [ae6d785]
  - @obelism/content@0.1.0
