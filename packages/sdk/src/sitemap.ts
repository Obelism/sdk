import type { Entry } from './types'

// Sitemaps and hreflang links from pages' paths per locale (`entry.paths`).
// The site decides where a locale's path lives (`/nl/over-ons`,
// `nl.example.com/over-ons`), so both take a `url` that turns a path and
// locale into an absolute URL.
//
//   const pages = []
//   for await (const page of content.getAllEntries({ contentType: 'page' })) pages.push(page)
//   const xml = sitemapXml(pages, { url: (path, locale) => `https://example.com/${locale}/${path}`, defaultLocale: 'en' })

export type LocalizedUrlOptions = {
	// The absolute URL of a path in a locale.
	url: (path: string, locale: string) => string
	// Adds an `x-default` link to this locale's URL.
	defaultLocale?: string | undefined
}

export type AlternateLink = { hreflang: string; href: string }

type Page = Pick<Entry, 'paths'> & Partial<Pick<Entry, 'updatedAt' | 'fields'>>

// Every locale's URL of a page, for `<link rel="alternate" hreflang>` tags
// and language switchers. Empty for data entries.
export const alternateLinks = (
	entry: Pick<Entry, 'paths'>,
	{ url, defaultLocale }: LocalizedUrlOptions,
): AlternateLink[] => {
	const links = Object.entries(entry.paths).map(([locale, path]) => ({
		hreflang: locale,
		href: url(path, locale),
	}))
	const fallback = defaultLocale ? entry.paths[defaultLocale] : undefined
	if (defaultLocale && fallback !== undefined) {
		links.push({ hreflang: 'x-default', href: url(fallback, defaultLocale) })
	}
	return links
}

export type SitemapOptions = LocalizedUrlOptions & {
	// Pages to leave out. Default: those with the SEO template's "Hide from
	// search engines" (`fields.noIndex`) on.
	exclude?: ((entry: Page) => boolean) | undefined
}

const escapeXml = (text: string) =>
	text.replace(
		/[<>&'"]/g,
		(char) =>
			({
				'<': '&lt;',
				'>': '&gt;',
				'&': '&amp;',
				"'": '&apos;',
				'"': '&quot;',
			})[char]!,
	)

const hidden = (entry: Page) => entry.fields?.noIndex === true

// A sitemap.xml with one `<url>` per page and locale, each listing the page
// in every locale (`xhtml:link`), and `lastmod` from `updatedAt`. Pages
// without paths (data entries) are skipped. Fetch the entries with a
// delivery token: drafts don't belong in a sitemap.
export const sitemapXml = (
	entries: Iterable<Page>,
	{ exclude = hidden, ...options }: SitemapOptions,
) => {
	const urls: string[] = []
	for (const entry of entries) {
		if (exclude(entry)) continue
		const links = alternateLinks(entry, options)
		const alternates = links
			.map(
				({ hreflang, href }) =>
					`<xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`,
			)
			.join('')
		for (const { hreflang, href } of links) {
			if (hreflang === 'x-default') continue
			urls.push(
				`<url><loc>${escapeXml(href)}</loc>${
					entry.updatedAt
						? `<lastmod>${escapeXml(entry.updatedAt)}</lastmod>`
						: ''
				}${links.length > 1 ? alternates : ''}</url>`,
			)
		}
	}
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
		...urls,
		'</urlset>',
	].join('\n')
}
