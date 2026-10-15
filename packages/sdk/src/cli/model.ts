import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { MANAGEMENT_PATH } from '../config'
import { formatPlan, type ModelPlan } from './format'

// `content model pull | plan | apply`: keeps a content model file in a
// repository in step with an environment. The token comes from
// $CONTENT_MANAGEMENT_TOKEN, never from an argument, so it stays out of shell
// history and CI logs. In GitHub Actions the plan also goes to the job
// summary.

export class CliError extends Error {
	constructor(
		message: string,
		readonly exitCode = 1,
	) {
		super(message)
	}
}

export type ModelCommandOptions = {
	command: 'pull' | 'plan' | 'apply'
	file: string
	url: string
	token: string
	prune: boolean
	log?: (message: string) => void
	summaryFile?: string | undefined
	fetch?: typeof fetch
}

type Call = { status: number; ok: boolean; json: Record<string, unknown> }

// Exit code: 0 done, 1 problems in the plan.
export const runModelCommand = async ({
	command,
	file,
	url,
	token,
	prune,
	log = console.log,
	summaryFile,
	fetch: fetchImpl = fetch,
}: ModelCommandOptions): Promise<number> => {
	const call = async (
		method: string,
		path: string,
		body?: unknown,
	): Promise<Call> => {
		const response = await fetchImpl(`${url}${MANAGEMENT_PATH}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				...(body !== undefined && { 'Content-Type': 'application/json' }),
			},
			...(body !== undefined && { body: JSON.stringify(body) }),
		}).catch((error: Error) => {
			throw new CliError(`Could not reach ${url}: ${error.message}`)
		})
		const text = await response.text()
		try {
			return {
				status: response.status,
				ok: response.ok,
				json: JSON.parse(text),
			}
		} catch {
			throw new CliError(
				`${response.status} from ${url}: ${text.slice(0, 200)}`,
			)
		}
	}

	if (command === 'pull') {
		const { ok, json } = await call('GET', '/model')
		if (!ok) throw new CliError(String(json.error ?? 'Pull failed'))
		await mkdir(dirname(file), { recursive: true })
		await writeFile(file, `${JSON.stringify(json, null, '\t')}\n`)
		const count = Array.isArray(json.contentTypes)
			? json.contentTypes.length
			: 0
		log(
			`Wrote ${count} ${count === 1 ? 'content type' : 'content types'} to ${file}.`,
		)
		return 0
	}

	let text: string
	try {
		text = await readFile(file, 'utf8')
	} catch {
		throw new CliError(`Can't read ${file}. Run \`content model pull\` first?`)
	}
	let model: unknown
	try {
		model = JSON.parse(text)
	} catch (error) {
		throw new CliError(`${file} is not valid JSON: ${(error as Error).message}`)
	}

	const { ok, status, json } = await call(
		'POST',
		command === 'plan' ? '/model/plan' : '/model/apply',
		{ model, prune },
	)
	// A plan with issues, or an apply refused for them, still has the plan.
	const plan = json.changes || json.issues ? (json as ModelPlan) : null
	if (!plan)
		throw new CliError(String(json.error ?? `${command} failed (${status})`))

	const applied = command === 'apply' && ok
	log(formatPlan(plan, { applied }))
	if (summaryFile) {
		await appendFile(
			summaryFile,
			`${formatPlan(plan, { markdown: true, applied })}\n`,
		)
	}
	return !ok || (plan.issues?.length ?? 0) > 0 ? 1 : 0
}
