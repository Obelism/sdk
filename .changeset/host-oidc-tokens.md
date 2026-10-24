---
'@obelism/improve-sdk': minor
'@obelism/content': minor
---

`token` takes a function too, and `./oidc` has `vercelOidc()` and `githubOidc()`: a deployment on Vercel or in GitHub Actions sends its host's identity token instead of a stored API token, once the space trusts it. `ContentClient` takes `space` and `environment` for a deployment trusted in several, and the CLI uses the job's token in GitHub Actions when `CONTENT_MANAGEMENT_TOKEN` isn't set.
