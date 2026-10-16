# Next.js example

A Next.js (App Router) site reading pages from Obelism Content, with live
preview in the visual editor.

```sh
cp .env.example .env.local   # add a delivery token
npm run dev
```

- `src/lib/content.ts` — a delivery client (published, cached), and drafts
  (uncached) with the token of the person editing: the visual editor's
  `cms_token` (from `readPreviewParams`) or the site token in draft mode.
- `src/app/[[...slug]]/page.tsx` — every page entry by path.
- `src/components/Page.tsx` — renders the entry with `useLiveEntry`, so edits
  in the visual editor show while they are typed; `editable(block)` lets
  editors click a block to select it.
- `src/app/layout.tsx` — `<ContentBridge />` starts the editor bridge (and,
  signed in on the site, the prompt bar).
- `src/app/cms/[...path]/route.ts` — editing on the site itself: open
  `/cms/login` (optionally `?return_to=/a/page`), sign in to Obelism
  Content, and you're back in draft mode with the prompt bar, Save and
  Publish. `/cms/logout` ends it. `src/lib/content.ts` reads drafts with the
  session's token while draft mode is on.
- `next.config.ts` — allows the CMS to frame the site.
- `src/app/api/content-prompt/route.ts` — optional: Claude as the model for
  prompt editing, instead of the CMS's default (Workers AI).

In the CMS, set the environment's **preview URL** (Space settings) to where
this site runs, e.g. `http://localhost:3001`.
