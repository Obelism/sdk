import { Cache, gql } from '@shopify/hydrogen'
import { data, Link } from 'react-router'

import { formatPrice } from '~/lib/money'
import { storefrontClientContext } from '~/lib/storefront'
import {
	formatPageTitle,
	getShopNameFromRootMatch,
} from '~/lib/storefront-shop'

import type { Route } from './+types/product-by-id'

const PRODUCT_BY_ID_QUERY = gql(`
  query ProductById($id: ID!) {
    product(id: $id) {
      id
      handle
      title
      vendor
      description
      featuredImage {
        url
        altText
        width
        height
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      variants(first: 1) {
        nodes {
          id
          availableForSale
        }
      }
    }
  }
`)

export function meta({ data, matches }: Route.MetaArgs) {
	return [
		{
			title: formatPageTitle(
				data?.product.title ?? 'Product',
				getShopNameFromRootMatch(matches[0]),
			),
		},
	]
}

export async function loader({ context, params }: Route.LoaderArgs) {
	const numericId = params.id ?? ''
	if (!/^\d+$/.test(numericId)) throw data(null, { status: 404 })

	const storefrontClient = context.get(storefrontClientContext)
	const { data: result, errors } = await storefrontClient.graphql(
		PRODUCT_BY_ID_QUERY,
		{
			variables: { id: `gid://shopify/Product/${numericId}` },
			// Cache.short(): the price and stock are fresh for a second, then refreshed
			// in the background for the rest of the minute.
			cache: Cache.short(),
		},
	)
	if (errors?.length) throw data(null, { status: 502 })
	if (!result?.product) throw data(null, { status: 404 })

	return { product: result.product }
}

// The GID route exists to show a Storefront API read by gid://shopify/Product/…
// with Cache.short(), without the handle-based route's variant logic.
export default function ProductById({ loaderData }: Route.ComponentProps) {
	const { product } = loaderData
	const variant = product.variants.nodes[0]
	const price = variant
		? product.priceRange.minVariantPrice
		: product.priceRange.maxVariantPrice

	return (
		<main
			className="max-w-page px-margin mx-auto w-full flex-1 py-12"
			id="main-content"
		>
			<p
				className="type-body-sm text-on-surface-secondary mb-2 break-all"
				data-product-gid
			>
				{product.id}
			</p>
			<div className="grid gap-8 md:grid-cols-2">
				{product.featuredImage ? (
					<img
						src={product.featuredImage.url}
						alt={product.featuredImage.altText ?? product.title}
						width={product.featuredImage.width ?? undefined}
						height={product.featuredImage.height ?? undefined}
						className="bg-surface-secondary aspect-square w-full object-cover"
					/>
				) : null}
				<div>
					<h1 className="type-display">{product.title}</h1>
					<p className="mt-2 text-lg font-medium" data-product-price>
						{formatPrice(price)}
					</p>
					<p className="mt-1 text-sm" data-product-stock>
						{variant?.availableForSale ? 'In stock' : 'Out of stock'}
					</p>
					{product.description ? (
						<p className="text-on-surface-secondary mt-6 max-w-prose">
							{product.description}
						</p>
					) : null}
					<Link
						className="text-interactive mt-6 inline-block underline"
						to={`/products/${product.handle}`}
					>
						Open the handle-based product page
					</Link>
				</div>
			</div>
		</main>
	)
}
