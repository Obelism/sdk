import { spawn } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { DEFAULT_URL, MANAGEMENT_PATH } from '../config'
import type { ModelFile } from '../types'
import { buildExamples, type ImproveStatus } from './examples'
import { CliError, runModelCommand } from './model'

// `content init`: starts a site's repository on a Space Environment, the
// one the management token belongs to.
//
// 1. Pulls the model file (content/content-model.json), like `model pull`.
// 2. Writes an example of what the delivery API answers per content type to
//    content/examples/<apiId>.json, and of the built-in improve block while
//    the organization has improve on (examples.ts).
// 3. Installs @obelism/content with the project's package manager. Only the
//    JS SDK: React's (@obelism/content-react) is the project's own choice.
// 4. Adds the token variables to .env.example, empty.
//
// Agents get the same steps from the CMS's getProjectSetup MCP tool and run
// this rather than writing the files themselves.

export type InitOptions = {
	url: string
	token: string
	// Where the model file and examples go, relative to `cwd`.
	dir: string
	install: boolean
	cwd?: string
	log?: (message: string) => void
	fetch?: typeof fetch
	// Runs a command in `cwd`; resolves with its exit code.
	run?: (command: string, args: string[], cwd: string) => Promise<number>
}

const PACKAGE_MANAGERS = [
	{ lockfile: 'pnpm-lock.yaml', command: 'pnpm', add: ['add'] },
	{ lockfile: 'yarn.lock', command: 'yarn', add: ['add'] },
	{ lockfile: 'bun.lock', command: 'bun', add: ['add'] },
	{ lockfile: 'bun.lockb', command: 'bun', add: ['add'] },
	{ lockfile: 'package-lock.json', command: 'npm', add: ['install'] },
] as const

const ENV_VARIABLES = [
	['CONTENT_DELIVERY_TOKEN', 'reads published content (cms_d_…)'],
	['CONTENT_PREVIEW_TOKEN', 'also reads drafts, server-side only (cms_p_…)'],
	[
		'CONTENT_MANAGEMENT_TOKEN',
		'changes the content model: content model pull|plan|apply (cms_m_…)',
	],
] as const

const exists = (path: string) =>
	access(path).then(
		() => true,
		() => false,
	)

const runCommand = (command: string, args: string[], cwd: string) =>
	new Promise<number>((resolve) => {
		const child = spawn(command, args, {
			cwd,
			stdio: 'inherit',
			shell: process.platform === 'win32',
		})
		child.on('error', () => resolve(127))
		child.on('close', (code) => resolve(code ?? 1))
	})

const writeJson = async (path: string, value: unknown) =>
	writeFile(path, `${JSON.stringify(value, null, '\t')}\n`)

// Whether the organization has improve on, and its tests and flags. A CMS
// without the endpoint has no improve block.
const readImprove = async (
	url: string,
	token: string,
	fetchImpl: typeof fetch,
): Promise<ImproveStatus> => {
	const response = await fetchImpl(`${url}${MANAGEMENT_PATH}/improve`, {
		headers: { Authorization: `Bearer ${token}` },
	}).catch((error: Error) => {
		throw new CliError(`Could not reach ${url}: ${error.message}`)
	})
	if (response.status === 404) return { enabled: false, sources: [] }
	const json = (await response.json().catch(() => ({}))) as Partial<
		ImproveStatus & { error: string }
	>
	if (!response.ok) {
		throw new CliError(String(json.error ?? `${response.status} from ${url}`))
	}
	return { enabled: json.enabled === true, sources: json.sources ?? [] }
}

const install = async (
	cwd: string,
	log: (message: string) => void,
	run: NonNullable<InitOptions['run']>,
) => {
	const manifestPath = join(cwd, 'package.json')
	let manifest: Record<string, Record<string, string> | undefined>
	try {
		manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
	} catch {
		log(
			'No package.json here, so nothing was installed: add @obelism/content to your project yourself.',
		)
		return
	}
	const dependencies = {
		...manifest.dependencies,
		...manifest.devDependencies,
	}
	const wanted = ['@obelism/content'].filter((name) => !dependencies[name])
	if (wanted.length === 0) {
		log('The SDK is already installed.')
		return
	}

	let manager: (typeof PACKAGE_MANAGERS)[number] = PACKAGE_MANAGERS.at(-1)!
	for (const candidate of PACKAGE_MANAGERS) {
		if (await exists(join(cwd, candidate.lockfile))) {
			manager = candidate
			break
		}
	}
	const args = [...manager.add, ...wanted]
	log(`Installing: ${manager.command} ${args.join(' ')}`)
	const code = await run(manager.command, args, cwd)
	if (code !== 0) {
		throw new CliError(
			`${manager.command} ${args.join(' ')} failed (exit ${code}). The files are written; install the SDK yourself.`,
		)
	}
}

// Appends the variables .env.example doesn't have yet. Never values.
const writeEnvExample = async (cwd: string, url: string) => {
	const path = join(cwd, '.env.example')
	const current = await readFile(path, 'utf8').catch(() => '')
	const has = (name: string) =>
		new RegExp(`^\\s*${name}\\s*=`, 'm').test(current)
	const lines = [
		...ENV_VARIABLES.filter(([name]) => !has(name)).flatMap(([name, about]) => [
			`# ${about}`,
			`${name}=`,
		]),
		...(url !== DEFAULT_URL && !has('CONTENT_URL')
			? [`CONTENT_URL=${url}`]
			: []),
	]
	if (lines.length === 0) return false
	const header = '# Obelism Content (written by `content init`)'
	const separator = current === '' || current.endsWith('\n') ? '' : '\n'
	await writeFile(
		path,
		`${current}${separator}${current ? '\n' : ''}${header}\n${lines.join('\n')}\n`,
	)
	return true
}

export const runInitCommand = async ({
	url,
	token,
	dir,
	install: shouldInstall,
	cwd = process.cwd(),
	log = console.log,
	fetch: fetchImpl = fetch,
	run = runCommand,
}: InitOptions): Promise<number> => {
	const base = join(cwd, dir)
	const modelFile = join(base, 'content-model.json')

	await runModelCommand({
		command: 'pull',
		// Relative, so the log names it the way the user would.
		file: relative(process.cwd(), modelFile) || modelFile,
		url,
		token,
		prune: false,
		log,
		fetch: fetchImpl,
	})
	const model = JSON.parse(await readFile(modelFile, 'utf8')) as ModelFile
	const improve = await readImprove(url, token, fetchImpl)

	const examples = buildExamples(model, improve)
	const examplesDir = join(base, 'examples')
	await mkdir(examplesDir, { recursive: true })
	for (const [apiId, example] of Object.entries(examples)) {
		await writeJson(join(examplesDir, `${apiId}.json`), example)
	}
	const count = Object.keys(examples).length
	log(
		`Wrote ${count} ${count === 1 ? 'example' : 'examples'} to ${join(dir, 'examples')}${
			improve.enabled
				? ', with the A/B test or flag block (_improve.json): improve is on'
				: ''
		}.`,
	)

	if (await writeEnvExample(cwd, url)) {
		log('Added the token variables to .env.example.')
	}

	if (shouldInstall) await install(cwd, log, run)

	log(
		[
			'',
			'Next:',
			'- Create a delivery token (and a preview token for drafts) in Space settings, and set CONTENT_DELIVERY_TOKEN and CONTENT_PREVIEW_TOKEN.',
			'- Fetch content with ContentClient from @obelism/content; the examples show what each type looks like.',
			...(improve.enabled
				? [
						"- Render _improve blocks: ask improve's SDK for the visitor's option (getTestValue / getFlagValue with the block's slug) and render pickImproveVariant(block, option).",
					]
				: []),
			`- Keep the model in step with \`content model pull|plan|apply\` (${join(dir, 'content-model.json')}).`,
		].join('\n'),
	)
	return 0
}
