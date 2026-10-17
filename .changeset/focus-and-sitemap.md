---
'@obelism/content': minor
---

Focal points and sitemaps. `Asset.focalPoint` is the point crops keep in view, and `imageUrl` / `imageSrcSet` pass it as `focus` for `fit: 'cover'` and `'crop'` (or the `focus` you give). `alternateLinks(entry, { url, defaultLocale })` gives every locale's URL of a page for hreflang tags, and `sitemapXml(entries, { url, defaultLocale })` builds a sitemap with alternates per locale.
