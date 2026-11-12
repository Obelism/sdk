# @obelism/improve-sdk-nuxt

## 0.1.0

### Minor Changes

- 757779c: New package: server-side A/B tests for Nuxt. `generateImproveNuxtMiddleware` is a Nitro server middleware that decides the visitor's variant before the page renders, keeps it in cookies and leaves it on `event.context.improve` (`getImproveContext`) for the page to render, the counterpart of `@obelism/improve-sdk-next`.
