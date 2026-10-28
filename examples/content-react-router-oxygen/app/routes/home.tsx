import { gql } from '@shopify/hydrogen'
import { data, Link, useRouteLoaderData } from 'react-router'

import {
	CollectionCard,
	COLLECTION_CARD_FRAGMENT,
	type CollectionCardData,
} from '~/components/CollectionCard'
import { ContentPage } from '~/components/content'
import { HomeHero } from '~/components/HomeHero'
import {
	ProductCard,
	PRODUCT_CARD_FRAGMENT,
	type ProductCardData,
} from '~/components/ProductCard'
import { PurchaseTest } from '~/components/purchase-test'
import { readContentPage } from '~/lib/content.server'
import type { PageEntry } from '~/lib/content-types'
import { envContext } from '~/lib/env'
import { variant } from '~/lib/improve.server'
import { useTestValue } from '~/lib/improve'
import { selectHomeHero } from '~/lib/home-hero'
import { storefrontClientContext } from '~/lib/storefront'
import {
	FALLBACK_SHOP_NAME,
	formatPageTitle,
	getShopNameFromRootMatch,
} from '~/lib/storefront-shop'
import type { loader as rootLoader } from '~/root'

import type { Route } from './+types/home'

const HOME_QUERY = gql(
	`
    query Home {
      products(first: 8, sortKey: CREATED_AT, reverse: true) {
        nodes {
          ...ProductCard
        }
      }
      collections(first: 3) {
        nodes {
          ...CollectionCard
        }
      }
      heroCollections: collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
        nodes {
          title
          handle
          description
          image {
            url
            altText
          }
          products(first: 1) {
            nodes {
              featuredImage {
                url
                altText
              }
            }
          }
        }
      }
    }
  `,
	[PRODUCT_CARD_FRAGMENT, COLLECTION_CARD_FRAGMENT],
)

export function meta({ matches, data }: Route.MetaArgs) {
	const shopName = getShopNameFromRootMatch(matches[0])
	const title = data?.entry?.fields.title
	return [
		{ title: formatPageTitle(title ?? 'Home', shopName) },
		{
			name: 'description',
			content:
				data?.entry?.fields.seoDescription ??
				`Shop new arrivals and featured categories at ${shopName}.`,
		},
	]
}

export async function loader({ context, request }: Route.LoaderArgs) {
	const env = context.get(envContext)
	const storefrontClient = context.get(storefrontClientContext)

	const [catalogue, content, test] = await Promise.all([
		storefrontClient.graphql(HOME_QUERY),
		readContentPage<PageEntry>(
			env,
			request,
			'home',
			context.cache,
			context.waitUntil,
		),
		variant(request, env, 'home-hero'),
	])
	const { data: catalogueData } = catalogue

	const headers = new Headers()
	for (const setCookie of test.cookies) headers.append('Set-Cookie', setCookie)

	return data(
		{
			featuredProducts: (catalogueData?.products.nodes ??
				[]) as ProductCardData[],
			featuredCollections: (catalogueData?.collections.nodes ??
				[]) as CollectionCardData[],
			heroCollections: catalogueData?.heroCollections.nodes ?? [],
			entry: content,
			variant: test.value,
		},
		{ headers },
	)
}

function NewArrivals({ products }: { products: readonly ProductCardData[] }) {
	return (
		<section
			className="bg-surface w-full pt-20 pb-12"
			aria-labelledby="new-arrivals-heading"
		>
			<div className="max-w-page px-margin mx-auto mb-4 flex items-center justify-between gap-4">
				<h2 id="new-arrivals-heading" className="type-heading-xl">
					New arrivals
				</h2>
				<Link
					to="/collections"
					className="min-h-touch-target text-on-surface focus-visible:outline-accent inline-flex items-center gap-1 rounded-sm text-sm font-normal no-underline hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-opacity"
				>
					<span>Collections</span>
					<span
						className="inline-flex size-4 shrink-0 items-center justify-center"
						aria-hidden="true"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="size-4"
						>
							<line x1="5" y1="12" x2="19" y2="12" />
							<polyline points="12 5 19 12 12 19" />
						</svg>
					</span>
				</Link>
			</div>

			{products.length > 0 ? (
				<div className="max-w-page px-margin mx-auto contain-paint">
					<ul
						role="list"
						className="grid grid-cols-1 gap-x-1 gap-y-10 md:grid-cols-2 lg:grid-cols-4"
					>
						{products.map((product) => (
							<li key={product.handle}>
								<ProductCard product={product} />
							</li>
						))}
					</ul>
				</div>
			) : null}
		</section>
	)
}

function ShopByCategory({
	collections,
}: {
	collections: readonly CollectionCardData[]
}) {
	return (
		<section className="w-full py-12" aria-labelledby="category-heading">
			<h2
				id="category-heading"
				className="type-heading-xl max-w-page px-margin mx-auto mb-4"
			>
				Shop by category
			</h2>
			{collections.length > 0 ? (
				<ul
					role="list"
					className="max-w-page px-margin mx-auto grid grid-cols-1 md:grid-cols-3"
				>
					{collections.map((collection) => (
						<li key={collection.handle}>
							<CollectionCard collection={collection} />
						</li>
					))}
				</ul>
			) : null}
		</section>
	)
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const rootData = useRouteLoaderData<typeof rootLoader>('root')
	// The loader decided; the browser reads the same slug from the cookie, so
	// this records the exposure without re-bucketing. The fallback keeps the
	// markup identical until the provider has loaded.
	const testValue = useTestValue('home-hero', loaderData.variant)
	const hero = selectHomeHero(
		loaderData.heroCollections,
		rootData?.shopInfo.name ?? FALLBACK_SHOP_NAME,
	)

	return (
		<main className="flex-1" id="main-content" tabIndex={-1}>
			{loaderData.entry ? (
				<ContentPage
					entry={loaderData.entry}
					variant={{ value: testValue ?? loaderData.variant }}
					showTitle={false}
				/>
			) : (
				<HomeHero hero={hero} />
			)}
			<NewArrivals products={loaderData.featuredProducts} />
			<ShopByCategory collections={loaderData.featuredCollections} />
			<section className="max-w-page px-margin mx-auto w-full py-12">
				<h2 className="type-heading-xl mb-2">Shopify by GID</h2>
				<p className="text-on-surface-secondary mb-4 max-w-prose text-sm">
					Reads <code>gid://shopify/Product/…</code> with{' '}
					<code>Cache.short()</code>.
				</p>
				{loaderData.featuredProducts[0] ? (
					<Link
						className="text-interactive underline"
						to={`/p/${loaderData.featuredProducts[0].id.split('/').pop()}`}
						data-gid-link
					>
						{loaderData.featuredProducts[0].title} by GID
					</Link>
				) : null}
			</section>
			<PurchaseTest />
		</main>
	)
}
