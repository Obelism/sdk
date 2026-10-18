---
'@obelism/content': minor
---

The client sends its token as `Obelism-Token` instead of `Authorization: Bearer`, so the delivery API can answer a delivery token from Cloudflare's edge cache (up to 60 seconds, cleared on publish). Needs Content with the edge cache; older Content only reads `Authorization`.
