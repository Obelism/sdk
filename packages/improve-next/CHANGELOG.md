# @obelism/improve-sdk-next

## 1.1.1

### Patch Changes

- Updated dependencies [02ad5b5]
  - @obelism/improve-sdk@3.0.0

## 1.1.0

### Minor Changes

- 5dc00c5: Country audience targeting (SSR/edge).

  - Audiences can now target `country` (ISO 3166-1 alpha-2). Coarse geo is derived
    from the request server-side — the browser can't determine it from the user
    agent — so country targeting resolves during **SSR / middleware bucketing**.
  - `ImproveServerSDK.getTestValue` / `getFlagValue` accept an optional
    `geo: { country }` argument, merged into the visitor before audience matching.
  - The Next middleware reads `x-vercel-ip-country` (falling back to Cloudflare's
    `cf-ipcountry`) and passes it into bucketing automatically.
  - `ParsedUserAgent` gains an optional `country`; `AUDIENCE_PARAMS` gains a
    `country` key so audiences can carry it.

  **Behavior change:** the client SDK now trusts a valid existing assignment cookie
  _before_ re-evaluating audience/allocation in `getTestValue` / `getFlagValue`.
  This makes an already-bucketed visitor sticky (and lets the browser honor a
  country-targeted variant that middleware assigned server-side, recording its
  exposure). Previously a returning visitor was re-checked against the audience on
  every call.

### Patch Changes

- Updated dependencies [5dc00c5]
  - @obelism/improve-sdk@2.1.0

## 1.0.0

### Major Changes

- 9da3160: Decouple analytics events from tests (test-independent event stream + exposures).

  **Breaking.** Attribution moves from write time to read time. Events are now
  recorded once per visitor, test-independently, and the server attributes them to
  whichever tests/flags the visitor was exposed to. This enables sharing events
  across tests/flags, flag analytics, and an org-wide event overview.

  - **`postAnalytic` is now global**: the signature drops the leading `testSlug`
    argument — `postAnalytic(event, payload?)` instead of
    `postAnalytic(testSlug, event, payload?)`. An event is emitted once per
    page/session (deduped by event name) and carries no test/variant.
  - **`usePostAnalytic()` takes no arguments** and returns
    `(event, payload?) => …`. Update call sites from
    `usePostAnalytic(slug)` → `usePostAnalytic()`.
  - **Automatic exposure beacons**: `getTestValue` / `getFlagValue` now emit an
    exposure beacon the first time they resolve a non-holdout variant for a
    visitor (audience-excluded and allocation-holdout visitors are not exposed).
    This is what the server joins against to attribute events, so **a visitor must
    read their variant (`useTestValue` / `getTestValue`) for their events to
    count** — the old implicit "first tracked event = exposure" behavior is gone.
  - **Beacon contract**: `POST /api/log` bodies are now discriminated by
    `type: 'event' | 'exposure'`; the event body no longer includes
    `testId`/`testValue`. Requires the matching server release (hard cutover — old
    beacons are rejected).
  - The mirrored GTM dataLayer entry's `improve` object no longer includes
    `test` / `variant`, only `visitorId`.

### Patch Changes

- Updated dependencies [9da3160]
  - @obelism/improve-sdk@2.0.0

## 0.5.2

### Patch Changes

- Updated dependencies [b57320a]
  - @obelism/improve-sdk@1.0.0

## 0.5.1

### Patch Changes

- Updated dependencies [fd3d8ac]
  - @obelism/improve-sdk@0.5.0

## 0.5.0

### Minor Changes

- 00319d9: Reliability, Security and performance improvements

### Patch Changes

- Updated dependencies [00319d9]
  - @obelism/improve-sdk@0.4.0

## 0.4.0

### Minor Changes

- df8f091: Setup Improve status hook

### Patch Changes

- Updated dependencies [df8f091]
  - @obelism/improve-sdk-react@0.4.0

## 0.3.6

### Patch Changes

- f1bcf15: Allow React 19
- Updated dependencies [f1bcf15]
  - @obelism/improve-sdk-react@0.3.6
  - @obelism/improve-sdk@0.3.6

## 0.3.5

### Patch Changes

- e16b7e1: 📦 - Modules bump
- Updated dependencies [e16b7e1]
  - @obelism/improve-sdk-react@0.3.5
  - @obelism/improve-sdk@0.3.5

## 0.3.4

### Patch Changes

- 906f987: Build fix
- Updated dependencies [906f987]
  - @obelism/improve-sdk-react@0.3.4
  - @obelism/improve-sdk@0.3.4

## 0.3.3

### Patch Changes

- 6cd624f: Dependencies bump
- Updated dependencies [6cd624f]
  - @obelism/improve-sdk-react@0.3.3
  - @obelism/improve-sdk@0.3.3

## 0.3.2

### Patch Changes

- ba40757: Return fetched config & expose org/env/state
- Updated dependencies [ba40757]
  - @obelism/improve-sdk@0.3.2
  - @obelism/improve-sdk-react@0.3.2

## 0.3.1

### Patch Changes

- 189c9b5: Allow baseUrl passing
- Updated dependencies [189c9b5]
  - @obelism/improve-sdk-react@0.3.1
  - @obelism/improve-sdk@0.3.1

## 0.3.0

### Minor Changes

- 3f0304b: API Authentication setup

### Patch Changes

- Updated dependencies [3f0304b]
  - @obelism/improve-sdk-react@0.3.0
  - @obelism/improve-sdk@0.3.0

## 0.2.0

### Minor Changes

- 0fb57fa: Validate cookie values and allow fetch config argument

### Patch Changes

- Updated dependencies [0fb57fa]
  - @obelism/improve-sdk-react@0.2.0
  - @obelism/improve-sdk@0.2.0

## 0.1.1

### Patch Changes

- 8ae0143: Base readme setup
- Updated dependencies [8ae0143]
  - @obelism/improve-sdk-react@0.1.1
  - @obelism/improve-sdk@0.1.1

## 0.1.0

### Minor Changes

- Monorepo release

### Patch Changes

- Updated dependencies
  - @obelism/improve-sdk-react@0.1.0
  - @obelism/improve-sdk@0.1.0
