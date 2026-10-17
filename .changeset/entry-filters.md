---
'@obelism/content': minor
---

`getEntries` and `getAllEntries` take `fields` (filters on the content type's fields, with `ne`, `in`, `gt`, `gte`, `lt`, `lte` and `exists`; a list means one of them) and `order` (`-publishedAt`, `fields.date`, …). `getFirstEntry` answers the first match or null, to find a settings or navigation entry without its id.
