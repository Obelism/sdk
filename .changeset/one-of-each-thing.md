---
'@obelism/content': patch
'@obelism/improve-sdk': patch
'@obelism/improve-sdk-next': patch
'@obelism/numbers-sdk': minor
---

Internal cleanups, and the shared visitor id:

- content: the bridge's contract, its two modes and the legacy script bridge are separate modules; a product page and a collection page are one `SHOP` table; the site's `/cms/api` allowlist and the bridge's calls come from one list; the prompt box and the on-site editor work the bridge state out once.
- improve: one assignment engine for the browser and the server SDKs, so they can't drift on audience, allocation or default values. The visitor of a visitor id now comes from numbers, as do the cookie names and the `Retry-After` parse; `getLegacyVisitorCookieName()` is new.
- improve-next: reads the legacy visitor cookie by that name rather than a literal.
- numbers: exports its visitor id helpers (`createVisitorId`, `isVisitorId`, the `VISITOR_ID_*` constants) and `parseRetryAfterMs`.
