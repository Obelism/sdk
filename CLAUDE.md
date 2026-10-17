# CLAUDE.md

## Project Overview

Obelism numbers SDK: the browser client of Obelism numbers, the events
service in `../obelism/apps/numbers` (its `POST /api/log` is the contract,
`src/server/ingest.ts` there). Structured like `../content-sdk` and
`../improve-sdk`. The improve SDK (`@obelism/improve-sdk`) sends its events
and exposures through this client.

## Commands

```bash
npm run build          # Build all packages (turbo)
npm run lint           # oxlint + tsc --noEmit
npm run test:ci        # vitest, once
npm run format         # Prettier
npm run changeset      # Before publishing
```

## Packages

- `packages/sdk` → `@obelism/numbers-sdk`
  - `.`: `createNumbers()` (`client.ts`): `track`, `pageView`, `expose`
    (improve's test and flag assignments), `autoTrack` (page views on
    history changes, `click` events for `data-numbers-id`), `visitor`,
    `setDevice`, `setEndpoint`. Safe to create on the server: outside the
    browser every call returns `null`.
  - The visitor (`visitor.ts`) is the improve SDK's `visitorId` cookie and
    id format; keep them in step with `../improve-sdk`'s
    `config/constants.ts` and `base.ts`, or visitors split in two.
  - Device categories (`device.ts`) are improve's audience values, worked
    out without a parser; improve passes its ua-parser-js result instead.
  - Limits (`constants.ts`) follow numbers' `ingest.ts`: 256-character
    fields, 8-character currency, 1024-character paths, 8 KB bodies.
  - Also built as one script tag, `dist/script.global.js`
    (`src/scriptEntry.ts` → `script.ts`, `rollup.script.config.mjs`):
    numbers serves it as its `public/script.js` (`npm run script:update`
    there after a release). Options are data attributes
    (`data-organization`, `data-environment`, `data-endpoint`); the client
    is `window.numbers`.

## Build

bunchee (dual ESM/CJS + .d.ts). TypeScript 7 has no JS compiler API, so
bunchee uses `@typescript/typescript6` for declarations.

## Code Style

Prettier: single quotes, tabs, no semicolons, trailing commas. Strict TS.

## Versioning & Publishing

Changesets. Push to `main` opens a release PR; merging it publishes to npm
(trusted publishing, `.github/workflows/publish-npm.yml`).
