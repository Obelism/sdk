---
name: connect-site
description: Connect a website's code to Obelism Content (and numbers' tracking): install the SDK, create delivery and preview tokens and a webhook in develop or staging, set the preview URL and check it works. Use when the user wants their site to read content from Content, show drafts in the visual editor, revalidate on publish, or track visitors with numbers.
---

# Connect a site to Content

Run this in the site's repository. Use the `obelism-content` MCP tools, and
the shell for the repository.

Integration changes (tokens, webhooks, settings) are refused in
`production` (`production_protected`): set everything up in `develop` or
`staging`, then tell the user exactly what to add in production from the
dashboard (Space settings).

## 1. Where

1. `listOrganizations`, `listSpaces`. Ask which Space is this site's if
   there is more than one.
2. Work in `develop` unless the user names another environment.

## 2. The code

1. `getProjectSetup` for the Space and environment, and follow its steps in
   order. It runs the SDK's `npx @obelism/content init` and says which files
   and environment variables the site needs.
2. Detect the framework from the repository (Next.js, Astro, Remix, plain)
   before changing files, and follow the SDK's example for it.

## 3. Tokens and the webhook

1. `createApiToken` for a **delivery** token (published content), and a
   **preview** token if the site shows drafts.
2. Token values and webhook signing secrets come back **once**. Write them
   straight into the site's local env file (`.env.local` or what the
   framework uses, never a file under version control), or hand them to the
   user. Never repeat them in chat, commits or logs.
3. If the site caches pages, `createWebhook` pointing at its revalidation
   route, then `sendTestWebhook` and `listWebhookDeliveries`: the delivery
   must have a 2xx. If it doesn't, read the response body it recorded and fix
   the route.
4. `updateSpaceSettings` with the preview URL, so the visual editor opens the
   site with drafts.

## 4. numbers (optional)

To count visitors, page views and clicks, add numbers' script or the
`@obelism/numbers-sdk` package. The snippets with this Organization's id are
on numbers' Setup page (`https://numbers.obelism.studio/setup`). A site that
already uses improve's SDK sends to numbers already.

Tag the elements whose clicks should count with `data-numbers-id`. For a
Content block, use its `_uid` (`data-numbers-id={block._uid}`), so the
visual editor shows each block's click rate.

## 5. Check and report

- Start the site locally, fetch a page that reads content, and confirm it
  renders the Space's content. Stop the server you started.
- Tell the user what you set up, which env variables hold the tokens, and
  the steps left for production in the dashboard.
