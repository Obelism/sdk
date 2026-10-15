import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CliError, runModelCommand } from './model'

const model = { version: 1, contentTypes: [{ apiId: 'page' }] }

let dir: string
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'content-cli-'))
})
afterEach(async () => {
	await rm(dir, { recursive: true, force: true })
})

const options = (fetchMock: typeof fetch) => ({
	file: join(dir, 'content', 'content-model.json'),
	url: 'https://cms.test',
	token: 'cms_m_x',
	prune: false,
	log: vi.fn(),
	fetch: fetchMock,
})

describe('runModelCommand', () => {
	it('pulls the model into the file', async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => Response.json(model))
		const opts = options(fetchMock)

		await expect(runModelCommand({ ...opts, command: 'pull' })).resolves.toBe(0)

		expect(fetchMock).toHaveBeenCalledWith(
			'https://cms.test/api/management/v1/model',
			expect.objectContaining({
				method: 'GET',
				headers: { Authorization: 'Bearer cms_m_x' },
			}),
		)
		expect(JSON.parse(await readFile(opts.file, 'utf8'))).toEqual(model)
		expect(opts.log).toHaveBeenCalledWith(
			`Wrote 1 content type to ${opts.file}.`,
		)
	})

	it('plans the file, and fails on problems', async () => {
		const fetchMock = vi.fn<typeof fetch>(async () =>
			Response.json({ changes: [], issues: [{ message: 'Nope' }] }),
		)
		const opts = options(fetchMock)
		const summaryFile = join(dir, 'summary.md')
		await writeFile(join(dir, 'model.json'), JSON.stringify(model))

		const code = await runModelCommand({
			...opts,
			file: join(dir, 'model.json'),
			command: 'plan',
			prune: true,
			summaryFile,
		})

		expect(code).toBe(1)
		const [url, init] = fetchMock.mock.calls[0]!
		expect(url).toBe('https://cms.test/api/management/v1/model/plan')
		expect(JSON.parse(String(init!.body))).toEqual({ model, prune: true })
		expect(await readFile(summaryFile, 'utf8')).toMatch(
			/^### Content model plan/,
		)
	})

	it('applies the file', async () => {
		const fetchMock = vi.fn<typeof fetch>(async () =>
			Response.json({ changes: [], issues: [] }),
		)
		const opts = options(fetchMock)
		await writeFile(join(dir, 'model.json'), JSON.stringify(model))

		await expect(
			runModelCommand({
				...opts,
				file: join(dir, 'model.json'),
				command: 'apply',
			}),
		).resolves.toBe(0)
		expect(fetchMock.mock.calls[0]![0]).toBe(
			'https://cms.test/api/management/v1/model/apply',
		)
	})

	it('says what went wrong', async () => {
		const opts = options(
			vi.fn<typeof fetch>(async () =>
				Response.json({ error: 'Invalid token' }, { status: 401 }),
			),
		)
		await expect(runModelCommand({ ...opts, command: 'pull' })).rejects.toThrow(
			new CliError('Invalid token'),
		)
		await expect(runModelCommand({ ...opts, command: 'plan' })).rejects.toThrow(
			/Can't read .*content-model\.json/,
		)
	})
})
