---
'@obelism/improve-sdk': minor
---

Events and exposures go to Obelism numbers through `@obelism/numbers-sdk`, now a dependency. They are sent to `https://numbers.obelism.studio/api/log` by default (a custom `baseUrl` keeps its own `/api/log`, and `setAnalyticsUrls` still overrides both), carry the page's path and UTM tags, and an event without a scope is scoped to the page's path instead of being refused. The visitor cookie and the payload are unchanged. The snake_case warning now comes from the numbers SDK (`[numbers]`), still silenced by `disableWarnings`.
