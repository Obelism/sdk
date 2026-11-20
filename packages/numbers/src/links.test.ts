// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { classifyLink, isDownload, isOutbound } from './links'

const link = (html: string) => {
	document.body.innerHTML = html
	return document.querySelector('a')!
}

beforeEach(() => {
	history.replaceState(null, '', '/')
})

describe('isOutbound', () => {
	it('is true for http(s) on another origin only', () => {
		expect(isOutbound('https://elsewhere.example/x')).toBe(true)
		expect(isOutbound(new URL('http://elsewhere.example'))).toBe(true)
		expect(isOutbound('/pricing')).toBe(false)
		expect(isOutbound(location.href)).toBe(false)
		expect(isOutbound('mailto:hello@elsewhere.example')).toBe(false)
		expect(isOutbound('http://[bad')).toBe(false)
	})
})

describe('isDownload', () => {
	it('knows files by their extension, not images', () => {
		expect(isDownload('/files/Report.PDF')).toBe(true)
		expect(isDownload('https://cdn.example/a.zip?v=2')).toBe(true)
		expect(isDownload('/photo.jpg')).toBe(false)
		expect(isDownload('/export')).toBe(false)
		expect(isDownload('/v1.2/export')).toBe(false)
	})

	it('counts a link with download, whatever it points at, but not data: URLs', () => {
		const named = link('<a href="/export" download>export</a>')
		expect(isDownload(named.href, named)).toBe(true)
		const data = link('<a href="data:text/csv,a,b" download>csv</a>')
		expect(isDownload(data.href, data)).toBe(false)
	})
})

describe('classifyLink', () => {
	it('scopes a download to its name, with GA4 params', () => {
		expect(classifyLink(link('<a href="/files/report.pdf">pdf</a>'))).toEqual({
			event: 'file_download',
			scope: 'report.pdf',
			params: { file_name: 'report', file_extension: 'pdf' },
		})
	})

	it('scopes an outbound click to its destination without the query', () => {
		expect(
			classifyLink(link('<a href="https://elsewhere.example/p?q=1">out</a>')),
		).toEqual({
			event: 'outbound_click',
			scope: 'https://elsewhere.example/p',
			params: { link_domain: 'elsewhere.example' },
		})
	})

	it('takes the scope from data-numbers-id, without params', () => {
		document.body.innerHTML =
			'<div data-numbers-id="hero_cta"><a href="https://elsewhere.example"><span>out</span></a></div>'
		expect(classifyLink(document.querySelector('span')!)).toEqual({
			event: 'outbound_click',
			scope: 'hero_cta',
		})
	})

	it('leaves out what is switched off, and other clicks', () => {
		const file = link('<a href="https://elsewhere.example/a.pdf">pdf</a>')
		expect(classifyLink(file, { downloads: false })).toMatchObject({
			event: 'outbound_click',
		})
		expect(classifyLink(file, { downloads: false, outbound: false })).toBe(null)
		expect(classifyLink(link('<a href="/pricing">same</a>'))).toBe(null)
		document.body.innerHTML = '<p>text</p>'
		expect(classifyLink(document.querySelector('p')!)).toBe(null)
	})
})
