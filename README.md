# Obelism SDKs

The official SDKs of [Obelism](https://www.obelism.studio): improve (A/B tests
and feature flags), Content (the headless CMS) and numbers (the events every
product shares). One repository, so a change that crosses SDKs ships together.

## Packages

| Folder                   | npm                          |                                                                                                                                          |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/numbers`       | `@obelism/numbers-sdk`       | Page views, events and clicks on tagged elements, as a module or one script tag                                                          |
| `packages/improve`       | `@obelism/improve-sdk`       | improve's server and client SDK; sends its events through the numbers SDK                                                                |
| `packages/improve-react` | `@obelism/improve-sdk-react` | improve's React provider and hooks                                                                                                       |
| `packages/improve-next`  | `@obelism/improve-sdk-next`  | improve's Next.js middleware                                                                                                             |
| `packages/content`       | `@obelism/content`           | The delivery API client, the visual editor bridge, rich text and image helpers, webhooks, the improve block helper and the `content` CLI |
| `packages/content-react` | `@obelism/content-react`     | Live preview hooks for the visual editor and `<RichText>`                                                                                |

## Claude plugin

`plugin/` is the Obelism plugin for Claude: Content, improve and numbers as
MCP servers, with skills to import a Claude Design page into Content, connect
a site and A/B test a block. See [its README](plugin/README.md).

```
/plugin marketplace add Obelism/sdk
/plugin install obelism@obelism
```

## Examples

- `improve-html`: a static site with the improve JS SDK; [preview](https://html.improve.obelism.studio)
- `improve-hono`: a Hono app with the improve server SDK; [preview](https://hono.improve.obelism.studio)
- `improve-react`: a React app with the improve React SDK; [preview](https://react.improve.obelism.studio)
- `improve-nextjs`: a Next.js app with the improve Next.js and React SDK; [preview](https://nextjs.improve.obelism.studio)
- `improve-nextjs-vercel`: the same with Vercel Edge Config; [preview](https://nextjs-vercel.improve.obelism.studio)
- `improve-nextjs-rsc`: resolving the variant in a React Server Component; [preview](https://nextjs-rsc.improve.obelism.studio)
- `content-nextjs`: a Next.js site with the Content SDKs and live preview in the visual editor
- `content-react-router-oxygen`: a React Router 7 + Hydrogen storefront on Shopify Oxygen, with Content, Improve, numbers, media and the Storefront API

## Development

```bash
npm install
npm run build
npm run lint
npm run test:ci
npm run changeset   # describe a change for the next release
```

## Releases

[Changesets](https://github.com/changesets/changesets). Every package has its
own version. A pull request that changes a package adds a changeset; on
`main` a "Version Packages" pull request collects them, and merging it
publishes to npm. A package that depends on another one here (improve on
numbers, improve-react on improve) gets a new version with it.

## Quick links

- [improve docs](https://improve.obelism.studio/docs)
- [Content docs](https://content.obelism.studio/docs)
- [numbers](https://numbers.obelism.studio)
