---
'@obelism/numbers-sdk': minor
---

`numbers.setStorage('cookie' | 'session' | 'none')` changes where the visitor id lives at runtime, e.g. to add the cookie once a visitor consents. Moving to the cookie keeps the id unless the cookie already holds a returning visitor's; leaving it deletes `obelism_visitor_id` and `visitorId` and starts a new id.
