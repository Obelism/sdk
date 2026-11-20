---
'@obelism/numbers-sdk': minor
---

`track(…, { page: { url } })` and `pageView({ page: { url } })` send the path and UTM tags of the page an event happened on, for events sent after the visitor moved on. Without it, nothing changes. UTM tags numbers would refuse (a NUL, or an emoji split by the 256-character cut) are left out or trimmed instead of losing the batch.
