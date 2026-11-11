---
'@obelism/content': minor
---

`pickImproveVariant` uses the improve block's own `fallback` when the caller names none, and `ImproveBlock` carries `fallback?: string`. Content writes it when an entry is published: it is the option a visitor who isn't in the test or flag sees, which Improve counts as its default and which is not always the first variant in the block.

```ts
// Before: a visitor outside the test got the block's first variant.
const blocks = pickImproveVariant(block, improve.getTestValue(block.slug))
```

A caller's own `fallback` argument still wins. An entry published before Content wrote the field, or a draft, has none, and the first variant is used as before.
