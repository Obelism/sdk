# CLAUDE.md

Obelism's public SDKs in one repository (`Obelism/sdk`): improve, Content and
numbers. It replaced `Obelism/improve-sdk`, `Obelism/content-sdk` and
`Obelism/numbers-sdk`, whose histories it holds (`git log --follow` works
across the move). The products are in `../obelism` (`apps/improve`,
`apps/content`, `apps/numbers`); their APIs are what these packages call.

## Commands

```bash
npm install            # at the root only: one package-lock.json
npm run build          # turbo, every package and example
npm run lint           # oxlint + tsc --noEmit
npm run test:ci        # vitest, once
npm run format         # Prettier
npm run changeset      # before a release

npx turbo run build lint test:ci --filter=@obelism/improve-sdk...   # one package and what depends on it
```

## Layout

- `packages/numbers` → `@obelism/numbers-sdk`
- `packages/improve` → `@obelism/improve-sdk`, `packages/improve-react` →
  `@obelism/improve-sdk-react`, `packages/improve-next` →
  `@obelism/improve-sdk-next`
- `packages/content` → `@obelism/content`, `packages/content-react` →
  `@obelism/content-react`
- `plugin/` → the Obelism Claude plugin (www's docs/adr/0011 in
  `../obelism`): Content's, improve's, numbers' and media's MCP servers
  (`plugin/.mcp.json`) and skills for the jobs that span them
  (`plugin/skills/*/SKILL.md`). Listed by `.claude-plugin/marketplace.json`
  at the root, so `/plugin marketplace add Obelism/sdk` installs it. Not an
  npm package and not in changesets: bump `version` in
  `plugin/.claude-plugin/plugin.json` and the marketplace entry together
  (`claude plugin validate .` checks both), and name only tools the servers
  have.
- `packages/typescript-config` (private): `base.json` and
  `react-library.json`, strict (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`), for every package and example. Public option
  types say `| undefined` on optional fields, so callers on
  `exactOptionalPropertyTypes` can pass one through
- `examples/improve-*` (each deployed by its own Vercel project, on `main`
  only, `vercel.json`) and `examples/content-nextjs`

Packages depend on each other through the workspace: improve on numbers,
improve-react and improve-next on improve, content-react on Content. Never
pin one to a version that isn't in the repository; changesets updates the
ranges when it versions.

## numbers (`packages/numbers`)

The browser client of Obelism numbers (`../obelism/apps/numbers`, whose
`POST /api/log` is the contract, `src/server/ingest.ts` there).

- `createNumbers()` (`client.ts`): `track`, `pageView`, `expose` (improve's
  test and flag assignments), `autoTrack` (page views on history changes,
  `click` events for `data-numbers-id`), `visitor`, `setDevice`,
  `setEndpoint`. Safe to create on the server: outside the browser every call
  returns `null`.
- The visitor (`visitor.ts`) is improve's `visitorId` cookie and id format;
  keep it in step with `packages/improve/src/config/constants.ts` and
  `base.ts`, or visitors split in two.
- Device categories (`device.ts`) are improve's audience values, worked out
  without a parser; improve passes its ua-parser-js result instead.
- Limits (`constants.ts`) follow numbers' `ingest.ts`: 256-character fields,
  8-character currency, 1024-character paths, 8 KB bodies.
- Also built as one script tag, `dist/script.global.js` (`src/scriptEntry.ts`
  → `script.ts`, `rollup.script.config.mjs`): numbers serves it as its
  `public/script.js` (`npm run script:update` there after a release).

## improve (`packages/improve`, `improve-react`, `improve-next`)

### SDK Design Pattern

- `BaseImproveSDK` is the shared base class (config fetching, environment handling)
- `ImproveServerSDK` and `ImproveClientSDK` extend it for their respective runtimes
- React SDK uses a factory function (`generateImproveProvider`) that creates a Context + hooks bundle
- Next.js SDK generates middleware that handles bot detection, route matching, cookie management, and URL rewriting

### Host tokens (`./oidc`)

`token` in `ImproveServerSDK` (and Content's `ContentClient`) is a
`TokenSource` (`src/tokenSource.ts`): a string or a function giving one per
request. `./oidc` has `vercelOidc()` (`@vercel/oidc`, an optional peer
dependency, so only that entry imports it) and `githubOidc()` (the Actions
token endpoint), for a deployment a space trusts (Obelism's www
docs/adr/0014). Each package has its own copy with its own default
audience; keep them in step. The main entries must never import `./oidc`.

### Backend API (https://improve.obelism.studio)

The SDK communicates with two endpoints (see `packages/improve/src/config/urls.ts`):

- **Datafile/Config** `GET /config` — fetches the organization's configuration (tests, flags, audiences) for an environment. Server SDK authenticates with a `token`; client SDK uses `organizationId` + `environment`.
- **Analytics** `POST /api/log` — receives analytic events (e.g. page_view, conversion) tied to a test slug. Client SDK's `postAnalytic()` sends here; `setAnalyticsUrls()` can redirect to a proxy to avoid ad blockers.

### Domain Concepts

- **Tests** — A/B or multi-variant experiments with an allocation % (traffic exposed), split ratios per variant, audience targeting, and linked analytic events (start/metrics/conversion).
- **Feature Flags** — on/off or multi-value toggles with audience-based splits. Unlike tests, flags are for gradual rollouts with instant rollback.
- **Audiences** — visitor segments based on device, OS, browser, or pointer type. The SDK matches visitors via user-agent parsing.
- **Visitors** — identified by a generated ID stored in a cookie. Server SDK caches assignments in memory; client SDK caches in cookies (1-month TTL).
- **Analytics/Events** — conversion tracking events posted to the API, tied to test slugs. Conversion rate = visitors reaching the goal / total visitors.
- **Environments** — `develop`, `staging`, `production`. Each has its own config from the API.

### Vercel Edge Config Integration

Optional integration syncs the datafile to Vercel Edge Config (`@vercel/edge-config`) for edge-optimized middleware. The store is named `obelism_improve_{organisation}`. Only active tests/flags/audiences are synced; draft tests load directly from the API.

## Content (`packages/content`, `content-react`)

- `packages/content` → `@obelism/content`
  - `.`: `ContentClient` (delivery API `/api/delivery/v1`), `readPreviewParams`
    (the visual editor's parameters, `cms_token` among them: the token sites
    read drafts with, never `cms_preview` alone),
    `editable`, rich text and image helpers, types
  - `./bridge`: `getContentBridge()`, plus prompt editing
    (`bridge.prompt()`, and the prompt box in `bridge/promptBox.ts`, plain
    DOM in a shadow root, exported as `mountPromptBox`). Also built as one
    script tag, `dist/bridge.global.js` (`src/bridgeScript.ts` →
    `bridge/script.ts`, `rollup.bridge.config.mjs`): the CMS serves it as its
    `public/bridge.js` (`npm run bridge:update` there after a release). The
    postMessage protocol must stay in step with
    `src/scopes/visualEditor/VisualEditor.tsx` in the CMS; the prompt
    itself runs in the CMS (`src/server/content/promptEdit.ts`,
    docs/adr/0008 there). The click-rate labels (`bridge/statsOverlay.ts`,
    also plain DOM in a shadow root) show the editor's `stats` message —
    rates from Obelism numbers per block uid, and its "Show click rates"
    switch (`visible`) — and are in the state as `stats` / `statsVisible`
  - `./site`: `createSiteEditing` (the `/cms/*` handler: login, callback,
    logout and the bridge's `/cms/api/…`, forwarded with the site token in
    an httpOnly cookie) and `readSiteToken`; editing on the site outside the
    visual editor (the CMS's content/docs/guides/site-editing.mdx, docs/adr/0010). The
    browser half is `bridge/siteBridge.ts`, which `getContentBridge` starts
    when the editing cookie is set; the prompt box's Form mode is the CMS's
    entry form in an iframe (`bridge.openForm`, `bridge/formFrame.ts`, a
    one-time URL from `/cms/api/form`; its postMessage protocol must stay in
    step with the CMS's `/site/form` page)
  - `./prompt`: `createPromptHandler` / `verifyPromptRequest`, for a
    customer's own model behind the space's prompt endpoint
  - `./webhooks`: `verifyWebhook` / `createWebhookHandler` and the
    `WebhookEvent` union, typed after the CMS's `payloadFor` callers
    (`src/server/content/webhooks.ts` there). The Standard Webhooks check is
    shared with `./prompt` (`standardWebhooks.ts`)
  - bin `content`: `content init` (`cli/init.ts`: pulls the model, writes
    an example per content type from it, `cli/examples.ts`, plus the
    improve block while the organization has improve on, from the
    management API's `/improve`; installs the SDK; `.env.example`) and
    `content model pull|plan|apply` (management API), moved from the CMS's
    `cli/`, and `content types` (`cli/typegen.ts`: content-types.ts, a type
    per content type, from the model). The CMS's `getProjectSetup` MCP tool tells agents to run `init`
  - On a site signed in to edit, `getContentBridge` mounts the on-site
    editor (`bridge/siteEditor.ts`, `mountSiteEditor`) instead of the prompt
    box: a panel docked beside the site (Ask, Edit fields = the form frame,
    answers previewed until kept), block names drawn on the page, a launcher.
    The prompt box stays for the visual editor and Content's canvas. What
    both share is in `bridge/labels.ts` (`SharedLabels`, then
    `PromptLabels` / `SiteEditorLabels`), `dom.ts` (icons, marks),
    `pagesPicker.ts`, `formSlot.ts` and `siteActions.ts`: fix it there
  - On the site the bridge also edits JSON (`bridge.view()` /
    `applyJson()`, the CMS's `/api/site/v1/entries/{id}/view|apply`) and
    lists the pages (`bridge.pages()` / `openPage()`, `GET pages`)
  - `pickImproveVariant` / `isImproveBlock` (`improve.ts`): the built-in
    `_improve` block (the CMS's docs/adr/0012)
- `packages/content-react` → `@obelism/content-react`: `ContentBridge`,
  `useLiveEntry`, `useContentBridge`, `useContentBridgeEvent`,
  `useContentPrompt` (the only
  `'use client'` module) and `RichText` (server-safe)
- `examples/content-nextjs`: App Router site with preview + live updates

## Build

bunchee 7 (dual ESM/CJS + .d.ts). TypeScript 7 has no JS compiler API, so
bunchee uses `@typescript/typescript6` for declarations. Shared code between
entries lands in a hashed chunk; a type that crosses entries needs a public
name (improve's `BaseImproveSDK` is exported from `./types` for that).
numbers and Content also build one script tag each with Rollup.

## Code Style

Prettier: single quotes, tabs, no semicolons, trailing commas. oxlint. Strict
TypeScript everywhere.

## Versioning & Publishing

Changesets, one version per package. Push to `main` opens or updates the
"Version Packages" pull request; merging it publishes to npm with trusted
publishing (`.github/workflows/publish-npm.yml`, no token): every package
lists `Obelism/sdk` and that workflow as its trusted publisher on npmjs.com.
