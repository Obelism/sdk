import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type { ModelFile } from '../types'
import { CliError, managementApi } from './model'
import { generateTypes } from './typegen'

// `content types`: writes content/content-types.ts (typegen.ts) from the
// environment's model, pulled like `model pull` with
// $CONTENT_MANAGEMENT_TOKEN, or from the model file with `--file`.

export type TypesCommandOptions = {
	// Where content-types.ts goes, relative to `cwd`.
	dir: string
	// Reads this model file instead of pulling the model.
	file?: string | undefined
	url: string
	token?: string | undefined
	cwd?: string
	log?: (message: string) => void
	fetch?: typeof fetch
}

const readModel = async (file: string): Promise<ModelFile> => {
	let text: string
	try {
		text = await readFile(file, 'utf8')
	} catch {
		throw new CliError(`Can't read ${file}. Run \`content model pull\` first?`)
	}
	try {
		return JSON.parse(text) as ModelFile
	} catch (error) {
		throw new CliError(`${file} is not valid JSON: ${(error as Error).message}`)
	}
}

export const runTypesCommand = async ({
	dir,
	file,
	url,
	token,
	cwd = process.cwd(),
	log = console.log,
	fetch: fetchImpl = fetch,
}: TypesCommandOptions): Promise<number> => {
	let model: ModelFile
	if (file) {
		model = await readModel(resolve(cwd, file))
	} else {
		if (!token) {
			throw new CliError(
				'CONTENT_MANAGEMENT_TOKEN is not set (or pass --file to read a model file).',
				2,
			)
		}
		const { ok, json } = await managementApi(
			url,
			token,
			fetchImpl,
		)('GET', '/model')
		if (!ok) throw new CliError(String(json.error ?? 'Pull failed'))
		model = json as unknown as ModelFile
	}
	if (!Array.isArray(model.contentTypes)) {
		throw new CliError('The model has no contentTypes')
	}

	const out = join(dir, 'content-types.ts')
	await mkdir(resolve(cwd, dir), { recursive: true })
	await writeFile(resolve(cwd, out), generateTypes(model))
	const count = model.contentTypes.length
	log(`Wrote ${count} ${count === 1 ? 'type' : 'types'} to ${out}.`)
	return 0
}
