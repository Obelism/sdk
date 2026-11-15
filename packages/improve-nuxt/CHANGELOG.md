# @obelism/improve-sdk-nuxt

## 0.2.0

### Minor Changes

- 379f5b1: Exclusion groups and holdouts (Improve's docs/adr/0014). The SDK asks for the datafile with `?groups=1` and runs the tests in an exclusion group or under a holdout: who is in them is decided by the visitor's id, the same in the browser and on the server, before any cookie, so a visitor is in at most one test of a group, and a holdout's visitors see each test's default and are exposed once as the holdout (`subjectKind: 'holdout'`, which Numbers' `expose` now takes). Tests outside groups and holdouts keep their random assignment and cookies.

  The server SDK adds `decideTest` (the Next.js and Nuxt middlewares use it, so a leftover cookie no longer puts a visitor in a test their bucket keeps them out of), removes such a cookie in `seedTestCookies`, and reads Vercel Global Config with `readVercelConfig` (the `production_f2` key, falling back to `production`).

  Until a site updates to this release, Improve serves the tests in a group or under a holdout with allocation 0: their visitors see the default.

### Patch Changes

- Updated dependencies [379f5b1]
  - @obelism/improve-sdk@3.8.0

## 0.1.0

### Minor Changes

- 757779c: New package: server-side A/B tests for Nuxt. `generateImproveNuxtMiddleware` is a Nitro server middleware that decides the visitor's variant before the page renders, keeps it in cookies and leaves it on `event.context.improve` (`getImproveContext`) for the page to render, the counterpart of `@obelism/improve-sdk-next`.
