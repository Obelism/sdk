---
'@obelism/numbers-sdk': minor
---

Export `classifyLink`, `isOutbound` and `isDownload`: the rules `autoTrack` uses for `outbound_click` and `file_download`, with the same scope and params, for sites that send events from their own pipeline. A link inside an empty `data-numbers-id=""` is now scoped like an untagged one (its file or destination) instead of to the page's path.

`TrackOptions` fields accept `undefined`, for callers on `exactOptionalPropertyTypes`.
