---
'@obelism/content': minor
---

`release` previews a release (`release_…`): on the client and per request, sent as the delivery API's `release` parameter. Every read the client makes asks for it, redirects and the content model too, and `readPreviewParams` now answers `cms_release` next to `cms_token`, so a site that forwards it shows the release its Preview button opened rather than every draft. The token must read drafts: a delivery token is refused.
