import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CliError } from './model'
import { runTypesCommand } from './typesCommand'

const model = {
	version: 1,
	contentTypes: [
		{
			apiId: 'page',
			name: 'Page',
			kind: 'page',
			fields: [{ apiId: 'title', name: 'Title', type: 'text' }],
		},
	],
}

let cwd: string
beforeEach(async () => {
	cwd = await mkdtemp(join(tmpdir(), 'content-types-'))
})
afterEach(async () => {
	await rm(cwd, { recursive: true, force: true })
})

describe('runTypesCommand', () => {
	it("pulls the environment's model and writes content-types.ts", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => Response.json(model))
		const log = vi.fn()

		await expect(
			runTypesCommand({
				dir: 'content',
				url: 'https://cms.test',
				token: 'cms_m_x',
				cwd,
				log,
				fetch: fetchMock,
			}),
		).resolves.toBe(0)

		expect(fetchMock).toHaveBeenCalledWith(
			'https://cms.test/api/management/v1/model',
			expect.objectContaining({
				method: 'GET',
				headers: { Authorization: 'Bearer cms_m_x' },
			}),
		)
		const types = await readFile(
			join(cwd, 'content', 'content-types.ts'),
			'utf8',
		)
		expect(types).toContain('export type Page = Entry<')
		expect(types).toContain('title: string | null')
		expect(log).toHaveBeenCalledWith(
			`Wrote 1 type to ${join('content', 'content-types.ts')}.`,
		)
	})

	it('reads the model file with --file, without a token', async () => {
		const fetchMock = vi.fn<typeof fetch>()
		await mkdir(join(cwd, 'content'))
		await writeFile(
			join(cwd, 'content', 'content-model.json'),
			JSON.stringify(model),
		)

		await runTypesCommand({
			dir: 'src/content',
			file: 'content/content-model.json',
			url: 'https://cms.test',
			cwd,
			log: vi.fn(),
			fetch: fetchMock,
		})

		expect(fetchMock).not.toHaveBeenCalled()
		expect(
			await readFile(join(cwd, 'src', 'content', 'content-types.ts'), 'utf8'),
		).toContain("'page'")
	})

	it('says what went wrong', async () => {
		const options = {
			dir: 'content',
			url: 'https://cms.test',
			cwd,
			log: vi.fn(),
		}
		await expect(runTypesCommand(options)).rejects.toThrow(
			/CONTENT_MANAGEMENT_TOKEN is not set/,
		)
		await expect(
			runTypesCommand({ ...options, file: 'missing.json' }),
		).rejects.toThrow(/Can't read .*missing\.json/)
		await expect(
			runTypesCommand({
				...options,
				token: 'cms_m_x',
				fetch: vi.fn<typeof fetch>(async () =>
					Response.json({ error: 'Invalid token' }, { status: 401 }),
				),
			}),
		).rejects.toThrow(new CliError('Invalid token'))
	})
})
