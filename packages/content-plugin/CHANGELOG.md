# @obelism/content-plugin

## 0.2.0

### Minor Changes

- 2a00f8e: `MANIFEST_SCHEMA` takes `contentTypes`: up to five content types a plugin brings into a Space environment's model when it is turned on there.

## 0.1.0

### Minor Changes

- d18f2a8: New package: build Obelism Content plugins. `connect()` speaks Content's plugin protocol from the plugin's frame (context, `setValue`, height, links, toasts, context tokens), `usePlugin()` from `/react` keeps it in React state, and `verifyContextToken()` from `/server` checks a context token against Content's JWKS. `MANIFEST_SCHEMA` is the manifest's JSON Schema.
