# @obelism/numbers-sdk

## 0.2.0

### Minor Changes

- e7d1ee9: An optional `spaceId`: the space (one site or project of the organization) to work in. The improve SDK loads that space's datafile and both send it with every event; the numbers script takes `data-space`. Without it, everything goes to the organization's first space, as before. Needs improve and numbers with spaces (Obelism/obelism#110 and #113) deployed.

## 0.1.0

### Minor Changes

- 127ac91: The first release: `createNumbers()` with `track`, `pageView`, `expose` and `autoTrack` (page views and clicks on `data-numbers-id` elements), the improve SDK's visitor cookie, and the script tag build numbers serves as `/script.js`.
