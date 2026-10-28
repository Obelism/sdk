import { describe, expectTypeOf, it } from 'vitest'

import type { ContentTypeDefinition, ModelFile } from './types'

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
