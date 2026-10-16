# CLAUDE.md

## Project Overview

Obelism Content SDK — the TypeScript monorepo for the SDKs of Obelism
Content, the visual headless CMS in `../obelism/apps/content` (its `docs/` describe
the APIs these packages call). Structured like `../improve-sdk`.

## Commands

```bash
npm run build          # Build all packages (turbo)
npm run lint           # oxlint + tsc --noEmit
npm run test:ci        # vitest, once
npm run format         # Prettier
npm run changeset      # Before publishing
```

## Packages

- `packages/sdk` → `@obelism/content`
  - `.`: `ContentClient` (delivery API `/api/delivery/v1`), `readPreviewParams`,
    `editable`, rich text and image helpers, types
  - `./bridge`: `getContentBridge()`, the module port of the CMS's
    `public/bridge.js`, plus prompt editing (`bridge.prompt()`, and the
    prompt box in `bridge/promptBox.ts`: plain DOM in a shadow root). The
    postMessage protocol must stay in step with
    `src/scopes/visualEditor/VisualEditor.tsx` in the CMS; the prompt
    itself runs in the CMS (`src/server/content/promptEdit.ts`,
    docs/adr/0008 there).
  - `./site`: `createSiteEditing` (the `/cms/*` handler: login, callback,
    logout and the bridge's `/cms/api/…`, forwarded with the site token in
    an httpOnly cookie) and `readSiteToken`; editing on the site outside the
    visual editor (the CMS's docs/site-editing.md, docs/adr/0010). The
    browser half is `bridge/siteBridge.ts`, which `getContentBridge` starts
    when the editing cookie is set
  - `./prompt`: `createPromptHandler` / `verifyPromptRequest`, for a
    customer's own model behind the space's prompt endpoint
  - bin `content`: `content init` (`cli/init.ts`: pulls the model, writes
    an example per content type from it, `cli/examples.ts`, plus the
    improve block while the organization has improve on, from the
    management API's `/improve`; installs the SDK; `.env.example`) and
    `content model pull|plan|apply` (management API), moved from the CMS's
    `cli/`. The CMS's `getProjectSetup` MCP tool tells agents to run `init`
  - `pickImproveVariant` / `isImproveBlock` (`improve.ts`): the built-in
    `_improve` block (the CMS's docs/adr/0012)
- `packages/react-sdk` → `@obelism/content-react`: `ContentBridge`,
  `useLiveEntry`, `useContentBridge`, `useContentBridgeEvent`,
  `useContentPrompt` (the only
  `'use client'` module) and `RichText` (server-safe)
- `examples/nextjs`: App Router site with preview + live updates

## Build

bunchee (dual ESM/CJS + .d.ts). TypeScript 7 has no JS compiler API, so
bunchee uses `@typescript/typescript6` for declarations.

## Code Style

Prettier: single quotes, tabs, no semicolons, trailing commas. Strict TS.
