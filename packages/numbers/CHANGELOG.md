# @obelism/numbers-sdk

## 0.8.0

### Minor Changes

- f01f677: `autoTrack({ webVitals: true })` sends a `web_vital` event per Core Web Vital (LCP, INP, CLS, FCP and TTFB, with their rating and element), which Numbers' Web vitals report shows at the 75th percentile by route and release. `release` names the deploy, so the report tells which one made a metric slower, and `sampleRate` (0 to 1) reports only that part of the visits, decided once per tab and sent as `sample`. `web-vitals` comes with the package in its own chunk, so a site that leaves it out downloads nothing extra; a script-tag site passes its own `load`. `numbers.webVitals(options)` starts them without the other autoTrack listeners.

  The script-tag build grows by about 1.9 kB minified (0.7 kB brotli), its `size` budget raised with it.

## 0.7.0

### Minor Changes

- 0fd8e1d: Export `classifyLink`, `isOutbound` and `isDownload`: the rules `autoTrack` uses for `outbound_click` and `file_download`, with the same scope and params, for sites that send events from their own pipeline. A link inside an empty `data-numbers-id=""` is now scoped like an untagged one (its file or destination) instead of to the page's path.

  `TrackOptions` fields accept `undefined`, for callers on `exactOptionalPropertyTypes`.

- 5bac22b: `track(…, { page: { url } })` and `pageView({ page: { url } })` send the path and UTM tags of the page an event happened on, for events sent after the visitor moved on. Without it, nothing changes. UTM tags numbers would refuse (a NUL, or an emoji split by the 256-character cut) are left out or trimmed instead of losing the batch.
- db77087: `routes` (and the script's `data-routes`) report a path with an id in it as its route: `/tests/[testId]` instead of one page per test.
- ded2a7a: `numbers.setStorage('cookie' | 'session' | 'none')` changes where the visitor id lives at runtime, e.g. to add the cookie once a visitor consents. Moving to the cookie keeps the id unless the cookie already holds a returning visitor's; leaving it deletes `obelism_visitor_id` and `visitorId` and starts a new id.

## 0.6.0

### Minor Changes

- 379f5b1: Exclusion groups and holdouts (Improve's docs/adr/0014). The SDK asks for the datafile with `?groups=1` and runs the tests in an exclusion group or under a holdout: who is in them is decided by the visitor's id, the same in the browser and on the server, before any cookie, so a visitor is in at most one test of a group, and a holdout's visitors see each test's default and are exposed once as the holdout (`subjectKind: 'holdout'`, which Numbers' `expose` now takes). Tests outside groups and holdouts keep their random assignment and cookies.

  The server SDK adds `decideTest` (the Next.js and Nuxt middlewares use it, so a leftover cookie no longer puts a visitor in a test their bucket keeps them out of), removes such a cookie in `seedTestCookies`, and reads Vercel Global Config with `readVercelConfig` (the `production_f2` key, falling back to `production`).

  Until a site updates to this release, Improve serves the tests in a group or under a holdout with allocation 0: their visitors see the default.

## 0.5.0

### Minor Changes

- 156a113: Batches the events of one task into one request, and adds `flush()`.

  - `track()`, `pageView()`, `formSubmit()` and `expose()` no longer post on their own: they queue, and a microtask later the queue goes out as one `POST /api/log` — an array of up to ten events (and at most 4 KB of JSON). A checkout that tracks its items, or a page that reports its impressions, is one request instead of many; nothing waits on a timer, so a page view is still sent in the same tick it is made.
  - `numbers.flush()` sends what is queued right away, e.g. on a route change before the app tears the client down.
  - `track()` still returns the request's promise, resolving with the batch's response.
  - The size warning is unchanged, and a 429 pauses every event in the batch.

  Needs numbers' `/api/log` to take an array of events; a single event is still sent as one object, so a client against an older numbers keeps working as long as it only makes one event per task.

- 3ff0881: Internal cleanups, and the shared visitor id:

  - content: the bridge's contract, its two modes and the legacy script bridge are separate modules; a product page and a collection page are one `SHOP` table; the site's `/cms/api` allowlist and the bridge's calls come from one list; the prompt box and the on-site editor work the bridge state out once.
  - improve: one assignment engine for the browser and the server SDKs, so they can't drift on audience, allocation or default values. A visitor id now comes from numbers, as do the cookie names and the `Retry-After` parse; `getLegacyVisitorCookieName()` is new.
  - improve-next: reads the legacy visitor cookie by that name rather than a literal.
  - numbers: exports its visitor id helpers (`createVisitorId`, `isVisitorId`, the `VISITOR_ID_*` constants) and `parseRetryAfterMs`.

### Patch Changes

- 34422c7: A leaner client, with the same events:

  - The page context (path and UTM tags) is worked out once per URL instead of on every event, and a URL without a query string skips `URLSearchParams` altogether.
  - The 8 KB body check and the snake_case name check only run when warnings are on (`data-debug` on the script, which leaves them off everywhere else); the size check no longer encodes the body when the warning is off.
  - One click listener for tagged elements and outbound/download links instead of two, and downloads are looked up in a `Set`.
  - A visitor that already has an id is only written to the legacy `visitorId` cookie when it is missing or stale, not on every page.
  - The dedupe keys and exposures a client remembers are capped at 1000 (oldest out first), so a long session can't grow them without bound.

  `dist/script.global.js` is 7.73 kB minified and 3.23 kB brotli; the budget moves to 8.5 kB / 3.5 kB for the batching code.

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
