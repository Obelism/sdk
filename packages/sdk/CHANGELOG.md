# @obelism/content

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
