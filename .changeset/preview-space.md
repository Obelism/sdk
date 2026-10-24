---
'@obelism/content': patch
---

The preview docs and the Next.js example pass the site's `space` and `environment` to the client that reads `cms_token`, and `content init` adds `CONTENT_SPACE_ID` and `CONTENT_ENVIRONMENT` to `.env.example`. With Content's delivery API refusing a token for another space than the one a request names, a `cms_token` someone made for their own space can no longer put that space's drafts on your site.
