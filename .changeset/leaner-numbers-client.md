---
'@obelism/numbers-sdk': patch
---

A leaner client, with the same events:

- The page context (path and UTM tags) is worked out once per URL instead of on every event, and a URL without a query string skips `URLSearchParams` altogether.
- The 8 KB body check and the snake_case name check only run when warnings are on (`data-debug` on the script, which leaves them off everywhere else); the size check no longer encodes the body when the warning is off.
- One click listener for tagged elements and outbound/download links instead of two, and downloads are looked up in a `Set`.
- A visitor that already has an id is only written to the legacy `visitorId` cookie when it is missing or stale, not on every page.
- The dedupe keys and exposures a client remembers are capped at 1000 (oldest out first), so a long session can't grow them without bound.

`dist/script.global.js` is 7.20 kB minified and 3.01 kB brotli, and CI now fails if it passes 8 kB / 3.3 kB.
