---
'@obelism/content': patch
---

`safeReturnTo` resolves `return_to` as a URL and keeps it only when it stays on the site, so `/cms/logout` and the sign-in callback can no longer redirect to another host through a tab or newline (`/%09/evil.test`).
