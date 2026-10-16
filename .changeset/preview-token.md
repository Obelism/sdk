---
'@obelism/content': minor
---

`readPreviewParams` also answers `token`: the `cms_token` the visual editor now adds for the person editing, which reads drafts through the delivery API for 8 hours. Read drafts with it rather than with a preview token whenever `cms_preview` is in the URL, which anyone can add. The README and the Next.js example do.
