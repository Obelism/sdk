import { type FunctionalComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
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

// Vue marks fragments for hydration; the HTML around them is what counts.
const html = async (props: Record<string, unknown>) =>
	(await renderToString(h(RichText, props))).replace(
		/<!--\[-->|<!--\]-->|<!---->/g,
		'',
	)

describe('RichText', () => {
	it('renders the same HTML as richTextToHtml', async () => {
		expect(await html({ document: doc })).toBe(richTextToHtml(doc))
	})

	it('lets nodes, marks and embeds be replaced', async () => {
		const Heading: FunctionalComponent = (_, { slots }) =>
			h('h2', { class: 'title' }, slots.default?.())
		const Bold: FunctionalComponent = (_, { slots }) =>
			h('b', slots.default?.())
		const Card: FunctionalComponent<{ entry: { contentType: string } }> = (
			props,
		) => h('aside', props.entry.contentType)
		const File: FunctionalComponent<{ asset: { filename: string } }> = (
			props,
		) => h('span', props.asset.filename)

		const output = await html({
			document: doc,
			nodes: { heading: Heading },
			marks: { bold: Bold },
			embeddedEntry: Card,
			embeddedAsset: File,
		})
		expect(output).toContain('<h2 class="title">Title</h2>')
		expect(output).toContain(
			'<b><a href="https://x.test" target="_blank" rel="noopener noreferrer">bold link</a></b>',
		)
		expect(output).toContain('<span>a.pdf</span><aside>card</aside>')
	})

	it('renders nothing without a document', async () => {
		expect(await html({ document: null })).toBe('')
	})
})
