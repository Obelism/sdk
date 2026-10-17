---
'@obelism/content': minor
---

`@obelism/content/webhooks`: `verifyWebhook` and `createWebhookHandler` verify the CMS's signed webhooks (Standard Webhooks) and hand over the typed `WebhookEvent`. `npx @obelism/content types` writes `content/content-types.ts`, a TypeScript type per content type, from the environment's model (or the model file with `--file`).
