---
'@obelism/content': minor
---

`ContentClient` takes `drafts`, on the client or per request: with a host token, drafts are read only when asked for (`Obelism-Drafts: true`), so a site's pages and its preview can share one connected deployment. `space` also picks the space of a deployment connected to several; a host token's environment comes from its connection's rule, and naming another `environment` is refused.
