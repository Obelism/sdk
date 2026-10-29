# React Router + Oxygen reference storefront

A React Router 7 storefront on Shopify Hydrogen and Oxygen that uses every
Obelism product against a real deployment: Content pages and on-site editing,
an Improve test decided in the loader, numbers page views and a server event,
Content assets, and a Storefront API product read by GID.

It starts from Shopify's [React Router template](https://shopify.dev/docs/storefronts/hydrogen/getting-started/deploy-a-template),
so the cart, collections, search, product pages and customer accounts are the
template's; the Obelism wiring is the part this example adds.

## What it adds

| Product | Where                                                                     | What to look at                                                                                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content | `app/lib/content.server.ts`, `app/routes/home.tsx`, `app/routes/page.tsx` | `contentFor` reads the Worker env, the splat route serves `pages/*`, `ContentBridge` starts the canvas, and `/cms/*` is the site-editing handler. Published reads go through `createFetchWithCache` with a 60-second TTL; drafts use `no-store` and answer `private, no-store` plus `noindex`.                       |
| Improve | `app/lib/improve.server.ts`, `app/lib/improve.tsx`, `app/routes/home.tsx` | One server SDK per isolate, `variant()` in the loader, both cookies on the first response, `useTestValue` in the browser for the exposure, and `oxygen-buyer-country` mapped to the SDK's `geo`.                                                                                                                     |
| numbers | `app/components/numbers-tracker.tsx`, `app/lib/numbers.server.ts`         | Page views on every navigation and a server `purchase` event through `POST /api/log` with the environment's token. The hosted script sends to the organization's **first** space, so this example uses the SDK's `autoTrack` for its own space; where the site is the first space, the script tag is the same thing. |
| Media   | `app/components/content.tsx`                                              | Content assets at three widths with `srcset`, a private file's signed URL, and hotspots from the asset's `products[].position`.                                                                                                                                                                                      |
| Shopify | `app/routes/product-by-id.tsx`                                            | A product read by `gid://shopify/Product/…` with `Cache.short()`, price and stock from the Storefront API.                                                                                                                                                                                                           |

The home route also keeps the template's new arrivals and collections, and the
test's two variants differ before hydration: `view-source` shows the loader's
value in `data-improve-variant`.

A deployment lives at `https://oxygen-test-store-a7b6e51a1b166c36689d.o2.myshopify.dev`
(private; open it with the deployment's `oxygen-auth-bypass-token` header).

## Run it locally

From the repository root (`Obelism/sdk`), where the workspace installs every
package and example:

```sh
npm install
cd examples/content-react-router-oxygen
cp .env.example .env    # tokens, ids and the store domain
npm run dev             # http://localhost:5173
```

The worker reads `.env` through Mini Oxygen, the same names it gets from the
Oxygen environment in production. With no Storefront API token the template
falls back to [mock.shop](https://mock.shop).

In Obelism, add `http://localhost:5173` to the space environment's **allowed
origins** (develop allows `http://localhost:*` by default), and set the Content
environment's **preview URL** to this origin to open the canvas.

### The Content it expects

The app reads a `home` page and any `pages/*` page. Create them in the space
with these blocks:

- **Hero** — an eyebrow, heading, text, an image and one call to action.
- **Text** — a heading and rich text.
- **Media showcase** — one image, a private file and a gallery. On the image,
  switch on **Show its products** so delivery adds `products[].position` and the
  page draws a hotspot for each tagged product. Tag products on the file in
  Media first; without a store connected to the space that list is empty.

Upload the image and the private file in **Media**, mark the file private, then
pick them in the entry. `content/content-model.json` is the model; the types in
`content/content-types.ts` are generated from it.

## Content model

`content/content-model.json` is the model, and `content/content-types.ts` its
generated types (the app imports from there):

```sh
CONTENT_MANAGEMENT_TOKEN=cms_m_… CONTENT_SPACE_ID=space_… CONTENT_ENVIRONMENT=develop \
  npx content model plan
CONTENT_MANAGEMENT_TOKEN=cms_m_… CONTENT_SPACE_ID=space_… CONTENT_ENVIRONMENT=develop \
  npx content model apply
```

## Deploy to Oxygen

Add these under **Storefront settings → Environments and variables**, the
tokens marked secret, then deploy:

| Variable                      | Value                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ |
| `PUBLIC_STORE_DOMAIN`         | `your-store.myshopify.com`                                               |
| `PUBLIC_STOREFRONT_API_TOKEN` | a public Storefront API token, or `PRIVATE_STOREFRONT_API_TOKEN` instead |
| `CONTENT_DELIVERY_TOKEN`      | `cms_d_…`                                                                |
| `CONTENT_SPACE_ID`            | `space_…`                                                                |
| `CONTENT_ENVIRONMENT`         | the environment this deployment shows                                    |
| `IMPROVE_ORGANIZATION_ID`     | `org_…`                                                                  |
| `IMPROVE_SPACE_ID`            | `space_…`                                                                |
| `IMPROVE_ENVIRONMENT`         | `develop`, `staging` or `production`                                     |
| `IMPROVE_API_TOKEN`           | `imp_…`                                                                  |
| `NUMBERS_ORGANIZATION_ID`     | `org_…`                                                                  |
| `NUMBERS_SPACE_ID`            | `space_…`                                                                |
| `NUMBERS_ENVIRONMENT`         | the same environment                                                     |
| `NUMBERS_API_TOKEN`           | `imp_…`                                                                  |

```sh
npx shopify hydrogen link
npx shopify hydrogen deploy --assets-dir dist/client --worker-dir dist/server
```

The variables are frozen per deployment: a rotated token reaches the site after
a redeploy. Point the Content environment's **preview URL** at the Oxygen
**environment** URL (not a deployment preview URL), and make that environment
public so the canvas can frame it. Add that same environment URL to the space
environment's **allowed origins** in Improve and numbers: every deployment's
preview URL is a new origin, so a preview is refused until its origin is added
or the environment allows any origin. Development stores and trials cannot have
a public environment; the single-store paid plans allow one.

## Docs

- [Shopify Oxygen](https://content.obelism.studio/docs/getting-started/oxygen)
- [React Router](https://content.obelism.studio/docs/getting-started/react-router)
- [Improve on React Router](https://improve.obelism.studio/docs/getting-started/react-router)
- [numbers](https://numbers.obelism.studio/docs/getting-started) and [POST /api/log](https://numbers.obelism.studio/docs/api/log#from-a-storefront)
- [Content assets](https://content.obelism.studio/docs/guides/assets) and [images](https://content.obelism.studio/docs/api/images)

## What this deployment verified

The app is deployed to Oxygen (the production environment of
`oxygen-test-store` on `obelism-commerce`). From the environment URL, with the
auth bypass header while the environment is private:

- Content renders the `home` and `pages/about` entries, assets with `srcset`, the
  signed private PDF, and the CSP that lets the canvas frame it.
- Improve's config and exposure requests from the Oxygen origin answer `200`
  after the environment URL is in allowed origins; `visitorId` and `home-hero`
  are set on the first response and variant B renders in the first paint.
- numbers page views POST `200` from the Oxygen origin.
- `/p/<id>` reads `gid://shopify/Product/…` with `Cache.short()` and shows the
  live price and stock.
- `/cms/login` redirects to Content with the environment URL as `redirect_uri`.
- A publish showed on Oxygen within 6 seconds.

## What this deployment could not verify

- **The canvas and a real `/cms/login` sign-in.** Oxygen offers only private
  environments on this development store ("Only private environments are
  available on your plan"), so the canvas gets the Shopify login page. That is
  the limit the Oxygen guide describes; the preview URL is set to the
  environment URL for when the store can publish it.
- **A second deployment's preview origin being refused.** Preview URLs change
  per deployment; the environment URL is the one added to allowed origins.
- **Hotspots from tagged products.** The space has no Shopify store connected to
  Content, so every asset's `products` list is empty; the renderer handles
  `products[].position` but has not drawn a non-empty list.
- **numbers and Improve dashboard counts.** Both accept the browser requests
  with `200`, but the space's numbers report still shows 0 and the test stays
  `pending`; that is the backend's queue, not the storefront.
