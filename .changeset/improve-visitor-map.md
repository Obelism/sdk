---
'@obelism/improve-sdk': patch
---

`ImproveServerSDK` keeps each visitor's user agents in a `Map` and reads assignments as own properties, so a request with the user agent `__proto__` can no longer write a test or flag assignment (and the country) onto `Object.prototype` and force every later visitor into the same variant. A visitor keeps at most 10 user agents, so one visitor id with ever-changing user agents no longer grows memory without bound.
