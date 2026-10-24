---
'@obelism/content': patch
---

The site bridge takes the editing cookie's base path only when it is plain path segments, so an injected `obelism_content_editing` cookie such as `/\evil.test` or `/%09/evil.test` can no longer point it at another origin. It only goes to http(s) page addresses, never a `javascript:` URL, and the default `pagePath` drops a leading slash so a page path can't become `//host`.
