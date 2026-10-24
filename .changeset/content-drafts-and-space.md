---
'@obelism/content': minor
---

`ContentClient` takes `drafts` (on the client, or per request) and `space`: with a host token, drafts are read only when asked for (`Obelism-Drafts: true`), so a site's pages and its preview can share one connected deployment, and `space` names the space of a deployment connected to several. The space environment comes from the connection's rule for the deployment's environment, so there is no `environment` option.
