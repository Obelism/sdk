---
'@obelism/numbers-sdk': minor
'@obelism/improve-sdk': minor
'@obelism/improve-sdk-next': patch
---

The numbers client sends with a CORS-safelisted `text/plain` body (no preflight), defaults to numbers' endpoint when a CDN serves the script, and takes `data-debug` and `data-storage="session|none"` for warnings and cookie-less counting. `autoTrack` can count outbound links, downloads and form submissions, and `formSubmit` sends one by hand. The visitor cookie is now `obelism_visitor_id`; the old `visitorId` is still read and written for a deprecation window, so visitors keep their id across older improve SDKs. `data-organization`, `data-space` and `data-storage` are now checked, with the same `data-debug` warning as the client's; outbound clicks and downloads carry `link_domain`, `file_name` and `file_extension`; and a second `autoTrack` replaces the first without counting the page view again.
