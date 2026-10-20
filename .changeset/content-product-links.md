---
'@obelism/content': minor
'@obelism/content-react': minor
---

Links to Shopify products and product pages: `Link`'s `type: 'product'` (the product and its product page), `linkHref`'s `product` option (default `/products/<handle>`), `editableProduct(product)` to mark the product a page shows, and on a site signed in to edit the prompt box's **Add a product page** (`bridge.product`, `bridge.createProductPage()`), with product pages opened at the environment's product path from the CMS, or `productPath` (also a `ContentBridge` prop). A `shopify` field's `unique` and a `link` field's `products` in `FieldDefinition`. Code that switches on `link.type` exhaustively needs a case for `'product'`.
