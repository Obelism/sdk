import { describe, expect, it } from 'vitest'

import { alternateLinks, sitemapXml } from './sitemap'

const url = (path: string, locale: string) =>
	`https://example.com/${locale}/${path}`

const about = {
	paths: { en: 'about-us', nl: 'over-ons' },
	updatedAt: '2026-10-17T12:00:00.000Z',
	fields: {},
}

describe('alternateLinks', () => {
	it('links every locale, and x-default to the default', () => {
		expect(alternateLinks(about, { url, defaultLocale: 'en' })).toEqual([
			{ hreflang: 'en', href: 'https://example.com/en/about-us' },
			{ hreflang: 'nl', href: 'https://example.com/nl/over-ons' },
			{ hreflang: 'x-default', href: 'https://example.com/en/about-us' },
		])
		expect(alternateLinks({ paths: {} }, { url })).toEqual([])
	})
})

describe('sitemapXml', () => {
	it('lists each page in each locale with its alternates', () => {
		const xml = sitemapXml(
			[
				about,
				{ paths: {}, fields: {} },
				{ paths: { en: 'secret', nl: 'geheim' }, fields: { noIndex: true } },
				{ paths: { en: 'a&b' } },
			],
			{ url, defaultLocale: 'en' },
		)
		expect(xml).toContain(
			'<url><loc>https://example.com/en/about-us</loc><lastmod>2026-10-17T12:00:00.000Z</lastmod><xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/about-us"/><xhtml:link rel="alternate" hreflang="nl" href="https://example.com/nl/over-ons"/><xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/about-us"/></url>',
		)
		expect(xml).toContain('<loc>https://example.com/nl/over-ons</loc>')
		expect(xml).not.toContain('secret')
		expect(xml).toContain('<loc>https://example.com/en/a&amp;b</loc>')
		expect(xml.match(/<url>/g)).toHaveLength(3)
	})
})
