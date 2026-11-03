---
'@obelism/content': minor
---

Links to Shopify collections: `Link`'s `type: 'collection'` (the collection and its collection page), `linkHref`'s `collection` option (default `/collections/<handle>`), and a `link` field's `collections` in `FieldDefinition`. Code that switches on `link.type` exhaustively needs a case for `'collection'`.
