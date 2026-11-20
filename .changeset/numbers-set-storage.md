---
'@obelism/numbers-sdk': minor
---

`numbers.setStorage('cookie' | 'session' | 'none')` changes where the visitor id lives at runtime, e.g. to add the cookie once a visitor consents. The id is kept unless a cookie already holds a returning visitor's; leaving the cookie deletes `obelism_visitor_id` and `visitorId`.
