import { describe, expect, it } from 'vitest'

import { linkHref } from './links'
import type { Link } from './types'

const page = (path: string | null, extras: Partial<Link> = {}): Link => ({
	type: 'entry',
	entry: { id: 'entry_1', title: 'Pricing', slug: 'pricing', path },
	query: null,
	hash: null,
	...(extras as object),
})

const address = (url: string, extras: Partial<Link> = {}): Link => ({
	type: 'url',
	url,
	query: null,
	hash: null,
	...(extras as object),
})

describe('linkHref', () => {
	it('puts a page at /<path> by default', () => {
		expect(linkHref(page('pricing'))).toBe('/pricing')
		expect(
			linkHref(page('pricing', { query: 'plan=pro', hash: 'compare' })),
		).toBe('/pricing?plan=pro#compare')
	})

	it("uses the site's routing for pages only", () => {
		const url = (path: string) => `/nl/${path === 'home' ? '' : path}`
		expect(linkHref(page('home'), { url })).toBe('/nl/')
		expect(linkHref(page('pricing', { hash: 'faq' }), { url })).toBe(
			'/nl/pricing#faq',
		)
		expect(linkHref(address('https://x.com/a'), { url })).toBe(
			'https://x.com/a',
		)
	})

	it("joins the address's own query and replaces its hash", () => {
		expect(linkHref(address('https://x.com/a?x=1#old', { query: 'y=2' }))).toBe(
			'https://x.com/a?x=1&y=2#old',
		)
		expect(linkHref(address('/a#old', { hash: 'new' }))).toBe('/a#new')
		expect(linkHref(address('mailto:hi@example.com'))).toBe(
			'mailto:hi@example.com',
		)
	})

	it('is null without a link or a path', () => {
		expect(linkHref(null)).toBeNull()
		expect(linkHref(undefined)).toBeNull()
		expect(linkHref(page(null))).toBeNull()
	})

	it('puts a product at /products/<handle>, or where `product` says', () => {
		const product = (extras: Partial<Link> = {}): Link => ({
			type: 'product',
			product: { id: 'gid://shopify/Product/42', handle: 'mug' },
			entry: null,
			query: null,
			hash: null,
			...(extras as object),
		})
		expect(linkHref(product({ hash: 'reviews' }))).toBe('/products/mug#reviews')
		const withPage = product({
			entry: { id: 'entry_9', title: 'Mug', slug: 'mug', path: 'shop/mug' },
		})
		expect(
			linkHref(withPage, {
				product: ({ handle }, page) =>
					page ? `/${page.path}` : `/shop/${handle}`,
			}),
		).toBe('/shop/mug')
		expect(
			linkHref(product(), { product: ({ handle }) => `/p/${handle}` }),
		).toBe('/p/mug')
	})
})
