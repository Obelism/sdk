# @obelism/numbers-sdk

## 0.3.0

### Minor Changes

- 3546a7b: The numbers client sends with a CORS-safelisted `text/plain` body (no preflight), defaults to numbers' endpoint when a CDN serves the script, and takes `data-debug` and `data-storage="session|none"` for warnings and cookie-less counting. `autoTrack` can count outbound links, downloads and form submissions, and `formSubmit` sends one by hand. The visitor cookie is now `obelism_visitor_id`; the old `visitorId` is still read and written for a deprecation window, so visitors keep their id across older improve SDKs. `data-organization` and `data-storage` are now checked, and a second `autoTrack` replaces the first instead of stacking listeners.

## 0.2.0

### Minor Changes

- e7d1ee9: An optional `spaceId`: the space (one site or project of the organization) to work in. The improve SDK loads that space's datafile and both send it with every event; the numbers script takes `data-space`. Without it, everything goes to the organization's first space, as before. Needs improve and numbers with spaces (Obelism/obelism#110 and #113) deployed.

## 0.1.0

### Minor Changes

- 127ac91: The first release: `createNumbers()` with `track`, `pageView`, `expose` and `autoTrack` (page views and clicks on `data-numbers-id` elements), the improve SDK's visitor cookie, and the script tag build numbers serves as `/script.js`.
