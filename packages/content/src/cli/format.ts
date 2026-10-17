// Turns a model plan from the management API into text for a terminal, or
// Markdown for a GitHub step summary or pull request comment.

export type ModelPlan = {
	changes?: {
		apiId: string
		name: string
		action: 'create' | 'update' | 'delete'
		fields?: { apiId: string; change: 'added' | 'removed' | 'changed' }[]
		reordered?: boolean
		settingsChanged?: boolean
		affectedEntries?: number
	}[]
	issues?: { contentType?: string; path?: string; message: string }[]
}

type Change = NonNullable<ModelPlan['changes']>[number]
type Issue = NonNullable<ModelPlan['issues']>[number]

const ACTION_SIGN: Record<string, string> = {
	create: '+',
	update: '~',
	delete: '-',
}
const FIELD_SIGN: Record<string, string> = {
	added: '+',
	removed: '-',
	changed: '~',
}

const plural = (count: number, one: string, many: string) =>
	`${count} ${count === 1 ? one : many}`

const describeChange = (change: Change) => {
	const details: string[] = []
	for (const field of change.fields ?? []) {
		details.push(`${FIELD_SIGN[field.change] ?? '~'} field ${field.apiId}`)
	}
	if (change.reordered) details.push('fields reordered')
	if (change.settingsChanged && change.action === 'update') {
		details.push('name, kind or description')
	}
	if (change.affectedEntries && change.affectedEntries > 0) {
		details.push(
			`removes values from ${plural(change.affectedEntries, 'entry', 'entries')}`,
		)
	}
	return details
}

const issueLine = ({ contentType, path, message }: Issue) =>
	`${[contentType, path].filter(Boolean).join(' › ')}: ${message}`

// `applied` says whether the plan already happened.
export const formatPlan = (
	plan: ModelPlan,
	{ markdown = false, applied = false } = {},
) => {
	const changes = plan.changes ?? []
	const issues = plan.issues ?? []
	const lines: string[] = []

	if (markdown) {
		lines.push(
			applied ? '### Content model applied' : '### Content model plan',
			'',
		)
	}

	if (issues.length > 0) {
		const count = plural(issues.length, 'problem', 'problems')
		lines.push(
			markdown
				? `**${count} — nothing can be applied:**`
				: `${count}; nothing can be applied:`,
		)
		for (const issue of issues) {
			lines.push(`${markdown ? '- ' : '  '}${issueLine(issue)}`)
		}
		lines.push('')
	}

	if (changes.length === 0) {
		lines.push(
			issues.length > 0
				? 'No other changes.'
				: 'No changes: the environment matches the file.',
		)
	} else {
		lines.push(
			`${plural(changes.length, 'content type', 'content types')} ${applied ? 'changed' : 'to change'}:`,
		)
		if (markdown) lines.push('', '```diff')
		for (const change of changes) {
			lines.push(
				`${ACTION_SIGN[change.action] ?? '~'} ${change.apiId} (${change.name})`,
			)
			for (const detail of describeChange(change)) lines.push(`    ${detail}`)
		}
		if (markdown) lines.push('```')
	}
	return lines.join('\n')
}
