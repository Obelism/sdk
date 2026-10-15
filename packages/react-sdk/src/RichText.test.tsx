import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { richTextToHtml, type RichTextNode } from '@obelism/content'
import { RichText } from './RichText'

const doc: RichTextNode = {
	type: 'doc',
	content: [
		{
			type: 'heading',
			attrs: { level: 3 },
			content: [{ type: 'text', text: 'Title' }],
		},
		{
			type: 'paragraph',
			content: [
				{ type: 'text', text: 'Plain <script> ' },
				{
					type: 'text',
					text: 'bold link',
					marks: [
						{ type: 'bold' },
						{
							type: 'link',
							attrs: { href: 'https://x.test', target: '_blank' },
						},
					],
				},
				{
					type: 'text',
					text: ' unsafe',
					marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
				},
			],
		},
		{
			type: 'bulletList',
			content: [
				{
					type: 'listItem',
					content: [
						{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
					],
				},
			],
		},
		{
			type: 'codeBlock',
			attrs: { language: 'ts' },
			content: [{ type: 'text', text: 'let a = 1' }],
		},
		{ type: 'horizontalRule' },
		{
			type: 'embeddedAsset',
			attrs: {
				id: 'asset_1',
				asset: {
					id: 'asset_1',
					url: 'https://x.test/a.pdf',
					filename: 'a.pdf',
					mimeType: 'application/pdf',
					size: 1,
					width: null,
					height: null,
					title: null,
					alt: null,
				},
			},
		},
		{
			type: 'embeddedEntry',
			attrs: { id: 'entry_1', entry: { id: 'entry_1', contentType: 'card' } },
		},
	],
}

describe('RichText', () => {
	it('renders the same HTML as richTextToHtml', () => {
		expect(renderToStaticMarkup(<RichText document={doc} />)).toBe(
			richTextToHtml(doc).replace('<br>', '<br/>').replace('<hr>', '<hr/>'),
		)
	})

	it('lets nodes, marks and embeds be replaced', () => {
		const html = renderToStaticMarkup(
			<RichText
				document={doc}
				nodes={{
					heading: ({ children }) => <h2 className="title">{children}</h2>,
				}}
				marks={{ bold: ({ children }) => <b>{children}</b> }}
				embeddedEntry={({ entry }) => <aside>{entry.contentType}</aside>}
				embeddedAsset={({ asset }) => <span>{asset.filename}</span>}
			/>,
		)
		expect(html).toContain('<h2 class="title">Title</h2>')
		expect(html).toContain(
			'<b><a href="https://x.test" target="_blank" rel="noopener noreferrer">bold link</a></b>',
		)
		expect(html).toContain('<span>a.pdf</span><aside>card</aside>')
	})

	it('renders nothing without a document', () => {
		expect(renderToStaticMarkup(<RichText document={null} />)).toBe('')
	})
})
