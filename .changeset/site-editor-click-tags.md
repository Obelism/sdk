---
'@obelism/content': patch
---

Every link or button the site tags with `data-numbers-id` gets a little tag on its corner: a cross before its first click, an hourglass while fewer than 20 visitors saw its page, then its click rate. The on-site editor shows them too while blocks are outlined, from the CMS's new `POST /api/site/v1/stats` (`createSiteEditing` forwards `/cms/api/stats`). New labels in `StatsLabels`: `clickedShort`, `noClicks`, `counting`.
