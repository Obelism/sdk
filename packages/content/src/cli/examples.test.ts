import { describe, expect, it } from 'vitest'

import type { ModelFile } from '../types'
import { buildExamples } from './examples'

const model: ModelFile = {
	version: 1,
	contentTypes: [
		{
			apiId: 'page',
			name: 'Page',
			kind: 'page',
			description: null,
			fields: [
				{ apiId: 'title', name: 'Title', type: 'text', localized: true },
				{
					apiId: 'layout',
					name: 'Layout',
					type: 'blocks',
					allowedBlocks: ['hero', 'section'],
				},
				{
					apiId: 'author',
					name: 'Author',
					type: 'reference',
					contentTypes: ['author'],
				},
			],
		},
		{
			apiId: 'author',
			name: 'Author',
			kind: 'data',
			description: null,
			fields: [{ apiId: 'name', name: 'Name', type: 'text', maxLength: 10 }],
		},
		{
			apiId: 'hero',
			name: 'Hero',
			kind: 'block',
			description: null,
			fields: [
				{ apiId: 'image', name: 'Image', type: 'asset', mimeTypes: ['image/'] },
				{ apiId: 'body', name: 'Body', type: 'richtext' },
				{
					apiId: 'tone',
					name: 'Tone',
					type: 'select',
					options: [
						{ value: 'calm', label: 'Calm' },
						{ value: 'loud', label: 'Loud' },
					],
				},
			],
		},
		// Allows itself: the examples have to end.
		{
			apiId: 'section',
			name: 'Section',
			kind: 'block',
			description: null,
			fields: [
				{ apiId: 'children', name: 'Children', type: 'blocks' },
				{
					apiId: 'file',
					name: 'File',
					type: 'asset',
					mimeTypes: ['application/pdf'],
				},
			],
		},
	],
}

const off = { enabled: false, sources: [] }

describe('buildExamples', () => {
	it('writes an entry per page and data type, in delivery shape', () => {
		const examples = buildExamples(model, off) as Record<string, any>
		expect(Object.keys(examples)).toEqual(['page', 'author', 'hero', 'section'])
		expect(examples.page).toMatchObject({
			contentType: 'page',
			slug: 'example',
			path: 'example',
			fields: {
				title: 'Example title',
				author: { id: 'entry_example', contentType: 'author' },
			},
		})
		expect(examples.author).toMatchObject({
			slug: null,
			fields: { name: 'Example na' },
		})
	})

	it('holds one of every allowed block at the top, with unique uids', () => {
		const layout = (buildExamples(model, off) as Record<string, any>).page
			.fields.layout
		expect(layout.map((block: any) => block._type)).toEqual(['hero', 'section'])
		expect(layout[0]).toMatchObject({
			image: {
				mimeType: 'image/jpeg',
				url: expect.stringContaining('https://'),
			},
			body: { type: 'doc' },
			tone: 'calm',
		})
		expect(layout[1].file).toMatchObject({
			mimeType: 'application/pdf',
			filename: 'example.pdf',
		})
		const uids = JSON.stringify(layout).match(/example\d+/g) ?? []
		expect(new Set(uids).size).toBe(uids.length)
	})

	it('ends blocks that allow themselves', () => {
		const section = (buildExamples(model, off) as Record<string, any>).section
		expect(JSON.stringify(section).length).toBeLessThan(5_000)
	})

	it('adds the improve block while improve is on, with the first test’s options', () => {
		const examples = buildExamples(model, {
			enabled: true,
			sources: [
				{
					kind: 'test',
					slug: 'homepage-hero',
					name: 'Homepage hero',
					options: [
						{ slug: 'control', name: 'Control' },
						{ slug: 'bolder-copy', name: 'Bolder copy' },
					],
				},
			],
		}) as Record<string, any>

		const layout = examples.page.fields.layout
		expect(layout.at(-1)).toMatchObject({
			_type: '_improve',
			kind: 'test',
			slug: 'homepage-hero',
			variants: {
				control: [{ _type: 'hero' }],
				'bolder-copy': [{ _type: 'hero' }],
			},
		})
		expect(examples._improve).toMatchObject({
			_type: '_improve',
			variants: { control: [expect.any(Object)] },
		})
		// Only the example's top-level lists get one, not the lists inside
		// its blocks.
		expect(
			layout.filter((block: any) => block._type === '_improve'),
		).toHaveLength(1)
		expect(JSON.stringify(layout[1].children).includes('_improve')).toBe(false)
	})

	it('names an example test while improve has none yet', () => {
		const examples = buildExamples(model, {
			enabled: true,
			sources: [],
		}) as Record<string, any>
		expect(examples._improve).toMatchObject({
			slug: 'example-test',
			variants: { control: expect.any(Array), variation: expect.any(Array) },
		})
	})

	it('writes a link to a page for a link field', () => {
		const examples = buildExamples(
			{
				version: 1,
				contentTypes: [
					{
						apiId: 'promo',
						name: 'Promo',
						description: 'A page that sends visitors on.',
						kind: 'page',
						fields: [{ apiId: 'next', name: 'Next', type: 'link' }],
					},
				],
			},
			off,
		) as Record<string, any>
		expect(examples.promo.fields.next).toEqual({
			type: 'entry',
			entry: {
				id: 'entry_example',
				title: 'Example page',
				slug: 'example',
				path: 'example',
			},
			query: null,
			hash: null,
		})
	})

	it('writes a store item for a shopify field', () => {
		const examples = buildExamples(
			{
				version: 1,
				contentTypes: [
					{
						apiId: 'shop',
						name: 'Shop',
						description: 'A shop page.',
						kind: 'page',
						fields: [
							{
								apiId: 'collection',
								name: 'Collection',
								type: 'shopify',
								resource: 'collection',
							},
							{
								apiId: 'products',
								name: 'Products',
								type: 'shopify',
								resource: 'product',
								multiple: true,
							},
						],
					},
				],
			},
			off,
		) as Record<string, any>
		expect(examples.shop.fields).toEqual({
			collection: {
				id: 'gid://shopify/Collection/1',
				handle: 'example-collection',
			},
			products: [{ id: 'gid://shopify/Product/1', handle: 'example-product' }],
		})
	})
})
