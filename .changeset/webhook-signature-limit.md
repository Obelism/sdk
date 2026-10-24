---
'@obelism/content': patch
---

Webhook and prompt verification refuses a `webhook-signature` header with more than 5 signatures and skips any that isn't 32 bytes before computing an HMAC, so an unsigned request can no longer make the endpoint hash its body thousands of times. A `tolerance` of `NaN` now rejects instead of turning the timestamp check off.
