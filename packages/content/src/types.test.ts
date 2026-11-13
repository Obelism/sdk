import { describe, expectTypeOf, it } from 'vitest'

import type {
	Block,
	ContentTypeDefinition,
	ModelFile,
	SharedFrom,
} from './types'

describe('ContentTypeDefinition', () => {
	it('takes groups, accent, code, previewImage, and when and editor on fields', () => {
		const model = {
			version: 1,
			contentTypes: [
				{
					apiId: 'hero',
					name: 'Hero',
					kind: 'block',
					description: 'The top of a page',
					previewImage: 'asset_123',
					accent: 'lilac',
					code: 'He',
					groups: [
						{ id: 'main', fieldIds: ['title', 'cta'] },
						{ id: 'style', label: 'Style', fieldIds: ['color'] },
					],
					fields: [
						{ apiId: 'title', name: 'Title', type: 'text' },
						{ apiId: 'cta', name: 'Button', type: 'boolean' },
						{
							apiId: 'color',
							name: 'Colour',
							type: 'text',
							when: { field: 'cta', equals: true },
							editor: { plugin: 'colors', config: { palette: 'brand' } },
						},
					],
				},
			],
		} satisfies ModelFile
		expectTypeOf(model).toExtend<ModelFile>()
	})

	it('keeps the presentation settings optional', () => {
		const older: ContentTypeDefinition = {
			apiId: 'tag',
			name: 'Tag',
			kind: 'data',
			description: null,
			fields: [],
		}
		expectTypeOf(older).toExtend<ContentTypeDefinition>()
		// @ts-expect-error not an accent
		const wrong: ContentTypeDefinition['accent'] = 'red'
		void wrong
	})
})

describe('Block', () => {
	it('carries _sharedFrom on a shared block, and not on others', () => {
		type Hero = Block<{ heading: string | null }, 'hero'>
		const shared: Hero = {
			_uid: 'b7',
			_type: 'hero',
			_sharedFrom: { id: 'entry_1', name: 'Shared hero' },
			heading: 'Hello',
		}
		const held: Hero = {
			...shared,
			_sharedFrom: {
				id: 'entry_1',
				name: 'Shared hero',
				heldAt: '2026-11-13T09:00:00.000Z',
			},
		}
		const local: Hero = { _uid: 'b8', _type: 'hero', heading: null }
		void [held, local]
		expectTypeOf(shared._sharedFrom).toEqualTypeOf<SharedFrom | undefined>()
	})
})
