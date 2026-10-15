import { describe, expect, it } from 'vitest'

import { formatPlan, type ModelPlan } from './format'

const plan: ModelPlan = {
	changes: [
		{
			apiId: 'tag',
			name: 'Tag',
			action: 'create',
			fields: [{ apiId: 'label', change: 'added' }],
			reordered: false,
			settingsChanged: true,
			affectedEntries: 0,
		},
		{
			apiId: 'page',
			name: 'Page',
			action: 'update',
			fields: [
				{ apiId: 'subtitle', change: 'removed' },
				{ apiId: 'title', change: 'changed' },
			],
			reordered: true,
			settingsChanged: false,
			affectedEntries: 3,
		},
	],
	issues: [],
}

describe('formatPlan', () => {
	it('lists each change with its fields and the entries it affects', () => {
		expect(formatPlan(plan)).toBe(
			[
				'2 content types to change:',
				'+ tag (Tag)',
				'    + field label',
				'~ page (Page)',
				'    - field subtitle',
				'    ~ field title',
				'    fields reordered',
				'    removes values from 3 entries',
			].join('\n'),
		)
	})

	it('writes Markdown for a job summary, saying whether it was applied', () => {
		const markdown = formatPlan(plan, { markdown: true, applied: true })
		expect(markdown).toMatch(
			/^### Content model applied\n\n2 content types changed:\n\n```diff\n\+ tag \(Tag\)/,
		)
		expect(markdown.endsWith('```')).toBe(true)
	})

	it('puts problems first, and says when nothing changes', () => {
		expect(
			formatPlan({
				issues: [
					{
						contentType: 'page',
						path: 'fields.0.type',
						message: 'Unknown value "x"',
					},
				],
			}),
		).toBe(
			[
				'1 problem; nothing can be applied:',
				'  page › fields.0.type: Unknown value "x"',
				'',
				'No other changes.',
			].join('\n'),
		)
		expect(formatPlan({ changes: [], issues: [] })).toBe(
			'No changes: the environment matches the file.',
		)
	})
})
