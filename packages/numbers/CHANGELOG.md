# @obelism/numbers-sdk

## 0.5.0

### Minor Changes

- 3ff0881: Internal cleanups, and the shared visitor id:

  - content: the bridge's contract, its two modes and the legacy script bridge are separate modules; a product page and a collection page are one `SHOP` table; the site's `/cms/api` allowlist and the bridge's calls come from one list; the prompt box and the on-site editor work the bridge state out once.
  - improve: one assignment engine for the browser and the server SDKs, so they can't drift on audience, allocation or default values. A visitor id now comes from numbers, as do the cookie names and the `Retry-After` parse; `getLegacyVisitorCookieName()` is new.
  - improve-next: reads the legacy visitor cookie by that name rather than a literal.
  - numbers: exports its visitor id helpers (`createVisitorId`, `isVisitorId`, the `VISITOR_ID_*` constants) and `parseRetryAfterMs`.

## 0.4.0

### Minor Changes

- 842d59b: The numbers client sends with a CORS-safelisted `text/plain` body (no preflight), defaults to numbers' endpoint when a CDN serves the script, and takes `data-debug` and `data-storage="session|none"` for warnings and cookie-less counting. `autoTrack` can count outbound links, downloads and form submissions, and `formSubmit` sends one by hand. The visitor cookie is now `obelism_visitor_id`; the old `visitorId` is still read and written for a deprecation window, so visitors keep their id across older improve SDKs. `data-organization`, `data-space` and `data-storage` are now checked, with the same `data-debug` warning as the client's; outbound clicks and downloads carry `link_domain`, `file_name` and `file_extension`; and a second `autoTrack` replaces the first without counting the page view again.

## 0.3.0

### Minor Changes

- 3546a7b: The numbers client sends with a CORS-safelisted `text/plain` body (no preflight), defaults to numbers' endpoint when a CDN serves the script, and takes `data-debug` and `data-storage="session|none"` for warnings and cookie-less counting. `autoTrack` can count outbound links, downloads and form submissions, and `formSubmit` sends one by hand. The visitor cookie is now `obelism_visitor_id`; the old `visitorId` is still read and written for a deprecation window, so visitors keep their id across older improve SDKs. `data-organization` and `data-storage` are now checked, and a second `autoTrack` replaces the first instead of stacking listeners.

## 0.2.0

### Minor Changes

- e7d1ee9: An optional `spaceId`: the space (one site or project of the organization) to work in. The improve SDK loads that space's datafile and both send it with every event; the numbers script takes `data-space`. Without it, everything goes to the organization's first space, as before. Needs improve and numbers with spaces (Obelism/obelism#110 and #113) deployed.

## 0.1.0

### Minor Changes

- 127ac91: The first release: `createNumbers()` with `track`, `pageView`, `expose` and `autoTrack` (page views and clicks on `data-numbers-id` elements), the improve SDK's visitor cookie, and the script tag build numbers serves as `/script.js`.
