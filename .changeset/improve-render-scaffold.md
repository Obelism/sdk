---
'@obelism/content': minor
---

`content init` writes `content/examples/_improve.md` beside `_improve.json` while the organization has Improve on: how a site renders a content A/B test before the first paint (Content's docs/adr/0035). Every variant in the page, tagged with `data-ob-imp` and `data-ob-opt`; a classic script and one style rule per test in the head; `seedTestCookies` at the edge; one exposure per test after paint; and the after-load swap for placements below the page type's fold. The same copy as Content's A/B tests guide, with a React example.

`ImproveBlock` carries `mode?: 'instant' | 'after-load' | null`, which Content stamps when an entry is published, and `fallback` may be `null`, as delivery answers it for an entry published before Content wrote it. `pickImproveVariant`'s `fallback` argument takes `null` too. The `_improve.json` example carries both fields.
