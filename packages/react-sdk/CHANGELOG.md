# @obelism/content-react

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
