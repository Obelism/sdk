# CLAUDE.md

## Project Overview

Obelism Content SDK — the TypeScript monorepo for the SDKs of Obelism
Content, the visual headless CMS in `../db-visual-cms` (its `docs/` describe
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
  - `./prompt`: `createPromptHandler` / `verifyPromptRequest`, for a
    customer's own model behind the space's prompt endpoint
  - bin `content`: `content model pull|plan|apply` (management API), moved
    from the CMS's `cli/`
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
