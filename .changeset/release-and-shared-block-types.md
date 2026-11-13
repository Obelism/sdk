---
'@obelism/content': minor
---

Types for what Content already sends about releases and shared blocks.

- `WebhookEvent` takes `release.published` and `release.review_requested` (`ReleasePublishedEvent`, `ReleaseReviewRequestedEvent`): `data.release` is `{ id, name }` (`WebhookRelease`) and `data.entries` the release's entries with their `action`, `publish` or `unpublish` (`WebhookReleaseEntry`); a review request adds `data.note`.
- `WebhookEvent` takes `block.published` (`BlockPublishedEvent`), sent instead of `entry.published` when a shared block is published: `data.entry` is the block and `data.entries` the published pages it updated.
- `Block` has an optional `_sharedFrom` (`SharedFrom`: `{ id, name, heldAt? }`) on a block that comes from a shared block entry; `heldAt` marks a page's copy held at an earlier publish. Types generated with `content types` get it too.

```ts
if (event.type === 'release.published') {
	for (const { path } of event.data.entries) {
		if (path) revalidatePath(`/${path}`)
	}
}
```
