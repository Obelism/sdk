import { describe, expect, it } from 'vitest'

import { readPreviewParams } from './preview'

describe('readPreviewParams', () => {
	const query =
		'cms_preview=1&cms_entry=entry_1&cms_environment=develop&cms_token=cms_v_abc'
	const expected = {
		entryId: 'entry_1',
		environment: 'develop',
		token: 'cms_v_abc',
		release: null,
	}

	it('reads the editor parameters from any shape of query', () => {
		expect(readPreviewParams(`https://site.example/blog?${query}`)).toEqual(
			expected,
		)
		expect(readPreviewParams(`?${query}`)).toEqual(expected)
		expect(
			readPreviewParams(new URL(`https://site.example/?${query}`)),
		).toEqual(expected)
		expect(readPreviewParams(new URLSearchParams(query))).toEqual(expected)
		expect(
			readPreviewParams({
				cms_preview: '1',
				cms_entry: ['entry_1'],
				cms_environment: 'develop',
				cms_token: 'cms_v_abc',
				other: undefined,
			}),
		).toEqual(expected)
	})

	it('reads the release the Preview button opened', () => {
		expect(readPreviewParams(`?${query}&cms_release=release_abc`)).toEqual({
			...expected,
			release: 'release_abc',
		})
	})

	it('has no token from a CMS that sends none', () => {
		expect(
			readPreviewParams(
				'?cms_preview=1&cms_entry=entry_1&cms_environment=develop',
			),
		).toEqual({
			entryId: 'entry_1',
			environment: 'develop',
			token: null,
			release: null,
		})
	})

	it('is null outside a preview', () => {
		expect(
			readPreviewParams('https://site.example/blog?cms_entry=x'),
		).toBeNull()
		expect(readPreviewParams({})).toBeNull()
	})
})
