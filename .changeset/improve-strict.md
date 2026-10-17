---
'@obelism/improve-sdk': patch
'@obelism/improve-sdk-next': patch
---

Strict TypeScript for the improve packages, and what it found: `ImproveServerSDK.getFlagValue` threw for an empty user agent (it now returns the flag's first option, as `getTestValue` returns the default), and for a flag without options when there was no visitor id (now `null`). The middleware leaves a request alone when no test value resolves instead of setting a cookie without one. The setup options and `geo` accept an explicit `undefined` (`exactOptionalPropertyTypes`).
