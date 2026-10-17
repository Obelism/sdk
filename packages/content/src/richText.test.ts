import { describe, expect, it } from 'vitest'

import { richTextToHtml, richTextToPlainText } from './richText'
import type { RichTextNode } from './types'

const doc: RichTextNode = {
	type: 'doc',
	content: [
		{
			type: 'heading',
			attrs: { level: 2 },
			content: [{ type: 'text', text: 'Intro' }],
		},
		{
			type: 'paragraph',
			content: [
				{ type: 'text', text: 'Some <b> ' },
				{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
				{ type: 'hardBreak' },
				{
					type: 'text',
					text: 'link',
					marks: [
						{ type: 'italic' },
						{ type: 'link', attrs: { href: '/about', target: '_blank' } },
					],
				},
				{
					type: 'text',
					text: 'bad',
					marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
				},
			],
		},
		{
			type: 'orderedList',
			attrs: { start: 3 },
			content: [
				{
					type: 'listItem',
					content: [
						{ type: 'paragraph', content: [{ type: 'text', text: 'three' }] },
					],
				},
			],
		},
		{
			type: 'embeddedAsset',
			attrs: {
				id: 'asset_1',
				asset: {
					id: 'asset_1',
					url: 'https://x.test/a.png',
					filename: 'a.png',
					mimeType: 'image/png',
					size: 1,
					width: 40,
					height: 30,
					title: null,
					alt: 'A "test"',
				},
			},
		},
		{
			type: 'embeddedEntry',
			attrs: { id: 'entry_1', entry: { id: 'entry_1', contentType: 'card' } },
		},
	],
}

describe('richTextToHtml', () => {
	it('renders the document like the delivery API does', () => {
		expect(richTextToHtml(doc)).toBe(
			[
				'<h2>Intro</h2>',
				'<p>Some &lt;b&gt; <strong>bold</strong><br>',
				'<em><a href="/about" target="_blank" rel="noopener noreferrer">link</a></em>',
				'bad</p>',
				'<ol start="3"><li><p>three</p></li></ol>',
				'<figure><img src="https://x.test/a.png" alt="A &quot;test&quot;" width="40" height="30"></figure>',
			].join(''),
		)
	})

	it('leaves embeds to the caller', () => {
		const html = richTextToHtml(doc, {
			renderEntry: (entry) =>
				`<card-${entry.contentType}></card-${entry.contentType}>`,
			renderAsset: (asset) => `[${asset.filename}]`,
		})
		expect(html.endsWith('[a.png]<card-card></card-card>')).toBe(true)
	})

	it('renders nothing for no document', () => {
		expect(richTextToHtml(null)).toBe('')
	})
})

describe('richTextToPlainText', () => {
	it('keeps only the text, a line per block', () => {
		expect(richTextToPlainText(doc)).toBe(
			'Intro\nSome <b> bold\nlinkbad\nthree',
		)
	})
})
