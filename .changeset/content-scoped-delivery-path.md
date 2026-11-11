---
'@obelism/content': patch
---

`ContentClient` asks the delivery API on its token's scoped path (`/api/delivery/v1/{space}/{environment}/…`) once the API has sent it there, skipping the redirect on every later request. Requests for drafts stay on the unscoped path, and a refused scoped request is asked again unscoped.
