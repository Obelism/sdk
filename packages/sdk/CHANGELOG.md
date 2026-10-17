# @obelism/content

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
