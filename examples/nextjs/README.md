# Next.js example

A Next.js (App Router) site reading pages from Obelism Content, with live
preview in the visual editor.

```sh
cp .env.example .env.local   # add a delivery and a preview token
npm run dev
```

- `src/lib/content.ts` — a delivery client (published, cached) and a preview
  client (drafts, uncached), picked per request by `readPreviewParams`.
- `src/app/[[...slug]]/page.tsx` — every page entry by path.
- `src/components/Page.tsx` — renders the entry with `useLiveEntry`, so edits
  in the visual editor show while they are typed; `editable(block)` lets
  editors click a block to select it.
- `src/app/layout.tsx` — `<ContentBridge />` starts the editor bridge.
- `next.config.ts` — allows the CMS to frame the site.
- `src/app/api/content-prompt/route.ts` — optional: Claude as the model for
  prompt editing, instead of the CMS's default (Workers AI).

In the CMS, set the environment's **preview URL** (Space settings) to where
this site runs, e.g. `http://localhost:3001`.
