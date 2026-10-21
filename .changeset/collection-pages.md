---
'@obelism/content': minor
'@obelism/content-react': minor
---

Collection pages, like product pages (ADR 0022 in Obelism/obelism):

- `editableCollection(collection)` marks the Shopify collection a page shows.
- On a collection route without a page, the prompt box offers **Add a collection page**, and `bridge.createCollectionPage()` makes one.
- `bridge.collection` is the collection the page shows, and each page from `pages()` has a `collection`.
- The page list opens collection pages at the environment's collection path, or at your own `collectionPath` (an option of `getContentBridge` and `<ContentBridge>`).
- The site handler passes `POST collection-pages` through to the CMS.
