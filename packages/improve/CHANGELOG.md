# @obelism/improve-sdk

## 3.0.0

### Major Changes

- 02ad5b5: `postAnalytic`'s `message` field is replaced by a required `scope` positional
  argument.

  Previously the second half of an event's identity (`message`) was optional
  free text — in practice used inconsistently across integrations (a URL path
  on one event, a button label on another, often left empty). `scope` makes
  that second dimension mandatory and structured: a short, stable identifier
  for where/what the event refers to, always present, not display text.

  ```ts
  // Before
  postAnalytic('button_click', {
  	message: 'Sign in',
  	params: { label: 'Sign in' },
  })

  // After
  postAnalytic('button_click', 'homepage_hero_login', {
  	params: { label: 'Sign in' },
  })
  ```

  The plain-string shorthand (`postAnalytic(event, 'some message')`) is removed
  — the shorthand for the common case is now simply passing `scope` directly:
  `postAnalytic('page_view', 'homepage')`.

  `ImproveEvents`' `start`/`metrics`/`conversion` fields change from bare event
  names to `{ event, scope }` pairs (`ImproveEventRef`) to match. `funnel`, and
  exposure tracking (`getTestValue`/`getFlagValue`), are unaffected.

## 2.2.0

### Minor Changes

- bcadf69: `postAnalytic`'s per-session dedup now supports a `dedupeKey` payload field.

  Previously `postAnalytic` deduped purely by event name, so any event fired more
  than once per page/session under the same name (e.g. a GA4-style
  `view_promotion` or `view_item_list` fired once per item/promotion) would only
  actually send the first time — every later call silently no-op'd.

  Passing `dedupeKey` scopes the dedup to `event` + `dedupeKey` instead, so the
  same event name can fire once per distinct subject:

  ```ts
  postAnalytic('view_promotion', {
  	message: 'Hero',
  	params: { type: 'Hero' },
  	dedupeKey: 'Hero',
  })
  ```

  Omitting `dedupeKey` keeps the existing once-per-event-name-per-session
  behavior, so this is non-breaking for existing callers (`page_view`,
  `purchase`, `sign_up`, ...).

## 2.1.0

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

## 2.0.0

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

## 1.2.0

### Minor Changes

- 2af02c9: Rich analytics payloads and GA4 / GTM event-name alignment.

  - **Structured `postAnalytic` payload**: the third argument now accepts a `{ value, currency, message, params }` object (GA4-style) in addition to the previous plain `message` string, which still works as a shorthand for `{ message }`. Pass a `value` (with `currency`) on your conversion event to unlock **revenue and average order value per variant**; `params` (e.g. a GA4 `ecommerce` object) is stored and mirrored to the GTM dataLayer.
  - **GTM dataLayer ecommerce**: `value`, `currency`, and any `params` ride along on the mirrored dataLayer entry, and passing a GA4 `ecommerce` object first pushes `{ ecommerce: null }` to clear the previous one (GA4-recommended reset).
  - **Event-name conventions**: new `ImproveEventName` / `ImproveRecommendedEventName` types offer the GA4 recommended names (`add_to_cart`, `purchase`, …) as autocomplete while still accepting any string. `postAnalytic` warns in development (once per name) when an event isn't `snake_case`; silence all SDK warnings with the new `disableWarnings` setup option. Event names in the reserved `gtm.*` namespace are ignored.
  - **Contract hardening**: `currency` is capped to the backend's 8-char limit, an invalid (non-object / array) `params` is dropped instead of failing the whole event, and an over-8KB payload warns before the backend would reject it — so a large `params` doesn't silently lose the event.
  - **Config types**: `ImproveEvents` gains an optional `funnel` (ordered funnel steps) to match the datafile.
  - The React `usePostAnalytic` hook accepts the same structured payload and `ImproveEventName` typing.

## 1.1.0

### Minor Changes

- bde6c79: Harden config fetching and analytics against the backend's new rate-limiting, auth, and validation behavior:

  - **Resilient config fetch**: retry transient failures (network, timeout, 5xx, 429) with exponential backoff + jitter, honoring a server `Retry-After`. Auth/validation rejections (403/404/400) fail fast. New `configRetries` option (default 2).
  - **Typed errors**: config fetch now throws `ImproveFetchError` carrying `reason`, HTTP `status`, and `retryAfterMs`, instead of a single opaque "timed-out" message — so a bad token/origin is distinguishable from a transient failure.
  - **Empty-config guard**: an empty `{}` response (unknown org/env) is normalized so `tests`/`flags`/`audience` are always present, fixing a `Cannot read properties of undefined` crash and failing open to defaults.
  - **Analytics field caps**: `event` and `message` are truncated to the backend's 256-char limit so over-length values aren't silently dropped with a 400.
  - **Reliable beacons**: analytics are sent with `keepalive` so conversions firing before a navigation aren't cancelled.
  - **Rate-limit backoff**: after a 429 the client suspends analytics posting for a cooldown window (honoring `Retry-After`).
  - **Edge caching**: new opt-in `configRevalidate` option, forwarded as `next: { revalidate }`, to reuse the datafile across requests now that the endpoint sends `Cache-Control: s-maxage`.

## 1.0.0

### Major Changes

- b57320a: Require ua-parser-js v2 as a peer dependency (was v1). The SDK now imports
  the named `{ UAParser }` export, matching ua-parser-js v2 which removed the
  default export. Consumers must upgrade ua-parser-js to v2.

## 0.5.0

### Minor Changes

- fd3d8ac: Add GTM / Google Ads dataLayer integration. The client SDK's `postAnalytic` now mirrors each event onto `window.dataLayer` with experiment dimensions (`improve: { test, variant, visitorId }`, tagged `_improve` for loop prevention), so events can drive Google Tag Manager / Google Ads conversions. Enabled by default; opt out with `dataLayer: false` in the setup args.

## 0.4.0

### Minor Changes

- 00319d9: Reliability, Security and performance improvements

## 0.3.6

### Patch Changes

- f1bcf15: Allow React 19

## 0.3.5

### Patch Changes

- e16b7e1: 📦 - Modules bump

## 0.3.4

### Patch Changes

- 906f987: Build fix

## 0.3.3

### Patch Changes

- 6cd624f: Dependencies bump

## 0.3.2

### Patch Changes

- ba40757: Return fetched config & expose org/env/state

## 0.3.1

### Patch Changes

- 189c9b5: Allow baseUrl passing

## 0.3.0

### Minor Changes

- 3f0304b: API Authentication setup

## 0.2.0

### Minor Changes

- 0fb57fa: Validate cookie values and allow fetch config argument

## 0.1.1

### Patch Changes

- 8ae0143: Base readme setup

## 0.1.0

### Minor Changes

- Monorepo release
