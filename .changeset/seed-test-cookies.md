---
'@obelism/improve-sdk': minor
---

`ImproveServerSDK.seedTestCookies`, for a server that decides variants before it renders a page: an edge function in front of a prerendered page, a middleware, a server renderer that wants the decision on the response.

It takes the request's `Cookie` header, its user agent and its country, and returns the visitor id, one cookie per test and flag the visitor is in, and the assignment behind each. A visitor outside a test's audience or allocation, or a flag's audience, is `included: false` and gets the default option and **no cookie**, so a page that carries every variant shows the default for them and records no exposure.

```ts
const { visitorId, cookies, assignments } = improve.seedTestCookies({
	cookieHeader: request.headers.get('Cookie'),
	userAgent: request.headers.get('User-Agent') ?? '',
	geo: { country: request.headers.get('CF-IPCountry') ?? undefined },
})
for (const { header } of cookies) response.headers.append('Set-Cookie', header)
```

Each cookie comes ready as a `Set-Cookie` header (30 days, `Path=/`, `SameSite=Lax`, `Secure` unless `secure: false`), and says whether it is the visitor's or a test's or flag's. An existing cookie is kept instead of re-rolling, a cookie naming an option the test no longer has is replaced, and a legacy `visitorId` cookie is migrated to `obelism_visitor_id`.

Also:

- A visitor learns they are out of a test once, so asking again for the same visitor keeps reporting the default option rather than a remembered assignment.
- A remembered assignment that names an option the datafile no longer has is no longer handed back: it is decided again.
