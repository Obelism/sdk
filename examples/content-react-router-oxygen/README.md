# React Router + Oxygen reference storefront

A React Router 7 storefront on Shopify Hydrogen and Oxygen that uses every
Obelism product against a real deployment: Content pages and on-site editing,
an Improve test decided in the loader, numbers page views and a server event,
Content assets, and a Storefront API product read by GID.

It starts from Shopify's [React Router template](https://shopify.dev/docs/storefronts/hydrogen/getting-started/deploy-a-template),
so the cart, collections, search, product pages and customer accounts are the
template's; the Obelism wiring is the part this example adds.

## What it adds

| Product | Where                                                                     | What to look at                                                                                                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content | `app/lib/content.server.ts`, `app/routes/home.tsx`, `app/routes/page.tsx` | `contentFor` reads the Worker env, the splat route serves `pages/*`, `ContentBridge` starts the canvas, and `/cms/*` is the site-editing handler. Published reads go through `createFetchWithCache` with a 60-second TTL; drafts use `no-store` and answer `private, no-store` plus `noindex`. |
| Improve | `app/lib/improve.server.ts`, `app/lib/improve.tsx`, `app/routes/home.tsx` | One server SDK per isolate, `variant()` in the loader, both cookies on the first response, `useTestValue` in the browser for the exposure, and `oxygen-buyer-country` mapped to the SDK's `geo`.                                                                                               |
| numbers | `app/root.tsx`, `app/lib/numbers.server.ts`                               | The script on every page and a server `purchase` event through `POST /api/log` with the environment's token.                                                                                                                                                                                   |
| Media   | `app/components/content.tsx`                                              | Content assets at three widths with `srcset`, a private file's signed URL, and hotspots from the asset's `products[].position`.                                                                                                                                                                |
| Shopify | `app/routes/product-by-id.tsx`                                            | A product read by `gid://shopify/Product/…` with `Cache.short()`, price and stock from the Storefront API.                                                                                                                                                                                     |

The home route also keeps the template's new arrivals and collections, and the
test's two variants differ before hydration: `view-source` shows the loader's
value in `data-improve-variant`.

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
public so the canvas can frame it. Development stores and trials cannot have a
public environment; the single-store paid plans allow one.

## Docs

- [Shopify Oxygen](https://content.obelism.studio/docs/getting-started/oxygen)
- [React Router](https://content.obelism.studio/docs/getting-started/react-router)
- [Improve on React Router](https://improve.obelism.studio/docs/getting-started/react-router)
- [numbers](https://numbers.obelism.studio/docs/getting-started) and [POST /api/log](https://numbers.obelism.studio/docs/api/log#from-a-storefront)
- [Content assets](https://content.obelism.studio/docs/guides/assets) and [images](https://content.obelism.studio/docs/api/images)

## What this store could not verify

The Obelism store this was built against is a development store, so Oxygen
refused a public environment. That leaves four checklist items unverified here:
the canvas framing a deployed environment, `/cms/login` with a real editor
account, a second deployment's preview origin being refused, and hotspots from
tagged Shopify products (the space has no store connected to Content). Locally,
the draft read, the TTL, the Improve cookies and variant, the numbers script and
server event, the signed private file and the GID product read all work.
