---
'@obelism/content': minor
'@obelism/content-react': patch
---

Paths per locale. `Entry.paths` holds a page's path in every locale, and `getPage(path, { locale })` looks the path up in that locale. `findPage` answers a moved page with `{ redirect: { path } }`, and `getRedirects` / `getAllRedirects` list the redirects per locale. Webhook entries have `paths`, and `entry.moved` has `previousPaths`. The bridge's `pagePath` gets the page's locale as a second argument.
