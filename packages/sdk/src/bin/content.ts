#!/usr/bin/env node
import { parseArgs } from 'node:util'

import { DEFAULT_URL, normalizeUrl } from '../config'
import { runInitCommand } from '../cli/init'
import { CliError, runModelCommand } from '../cli/model'

const USAGE = `Usage: content init [--dir content] [--url origin] [--skip-install]
       content model <pull|plan|apply> [--file path] [--url origin] [--prune]

  init          start a site's repository on the token's environment: the
                model file, an example per content type, the SDK installed
                and the token variables in .env.example
  model pull    write the environment's model to the file
  model plan    show what applying the file would change, and what stands in the way
  model apply   apply the file in one transaction, or change nothing

  --dir           where init writes content-model.json and examples/ (default content)
  --skip-install  init leaves dependencies alone
  --file          the model file (default content/content-model.json)
  --url           the CMS (default $CONTENT_URL, else ${DEFAULT_URL})
  --prune         plan and apply also delete content types the file leaves out

Needs CONTENT_MANAGEMENT_TOKEN: a management token from Space settings.`

const main = async () => {
	let parsed
	try {
		parsed = parseArgs({
			allowPositionals: true,
			options: {
				file: { type: 'string', default: 'content/content-model.json' },
				url: { type: 'string' },
				prune: { type: 'boolean', default: false },
				dir: { type: 'string', default: 'content' },
				'skip-install': { type: 'boolean', default: false },
				help: { type: 'boolean', short: 'h', default: false },
			},
		})
	} catch (error) {
		throw new CliError(`${(error as Error).message}\n\n${USAGE}`, 2)
	}
	const { values, positionals } = parsed
	const [group, command] = positionals

	if (values.help) {
		console.log(USAGE)
		return 0
	}
	const isInit = group === 'init' && command === undefined
	const modelCommand =
		group === 'model' &&
		(command === 'pull' || command === 'plan' || command === 'apply')
			? command
			: null
	if (!isInit && !modelCommand) throw new CliError(USAGE, 2)

	const token = process.env.CONTENT_MANAGEMENT_TOKEN
	if (!token) {
		throw new CliError(`CONTENT_MANAGEMENT_TOKEN is not set.\n\n${USAGE}`, 2)
	}
	const url = normalizeUrl(values.url ?? process.env.CONTENT_URL ?? DEFAULT_URL)

	if (!modelCommand) {
		return runInitCommand({
			url,
			token,
			dir: values.dir,
			install: !values['skip-install'],
		})
	}

	return runModelCommand({
		command: modelCommand,
		file: values.file,
		url,
		token,
		prune: values.prune,
		summaryFile: process.env.GITHUB_STEP_SUMMARY || undefined,
	})
}

main().then(
	(code) => process.exit(code),
	(error) => {
		if (error instanceof CliError) {
			console.error(error.message)
			process.exit(error.exitCode)
		}
		console.error(error)
		process.exit(1)
	},
)
