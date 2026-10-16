import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runInitCommand } from './init'

const model = {
	version: 1,
	contentTypes: [
		{
			apiId: 'page',
			name: 'Page',
			kind: 'page',
			fields: [{ apiId: 'layout', name: 'Layout', type: 'blocks' }],
		},
		{
			apiId: 'hero',
			name: 'Hero',
			kind: 'block',
			fields: [{ apiId: 'title', name: 'Title', type: 'text' }],
		},
	],
}

let cwd: string
beforeEach(async () => {
	cwd = await mkdtemp(join(tmpdir(), 'content-init-'))
})
afterEach(async () => {
	await rm(cwd, { recursive: true, force: true })
})

const cms = (improve: unknown, improveStatus = 200) =>
	vi.fn<typeof fetch>(async (input) =>
		String(input).endsWith('/model')
			? Response.json(model)
			: Response.json(improve, { status: improveStatus }),
	)

const options = (fetchMock: typeof fetch) => ({
	url: 'https://cms.test',
	token: 'cms_m_x',
	dir: 'content',
	install: true,
	cwd,
	log: vi.fn(),
	fetch: fetchMock,
	run: vi.fn(async () => 0),
})

const readJson = async (path: string) =>
	JSON.parse(await readFile(join(cwd, path), 'utf8'))

describe('runInitCommand', () => {
	it('writes the model, an example per type and the improve block', async () => {
		await writeFile(
			join(cwd, 'package.json'),
			JSON.stringify({ dependencies: { react: '^19.0.0' } }),
		)
		await writeFile(join(cwd, 'pnpm-lock.yaml'), '')
		const opts = options(
			cms({
				enabled: true,
				sources: [
					{
						kind: 'flag',
						slug: 'sale',
						name: 'Sale',
						options: [
							{ slug: 'on', name: 'On' },
							{ slug: 'off', name: 'Off' },
						],
					},
				],
			}),
		)

		await expect(runInitCommand(opts)).resolves.toBe(0)

		expect(await readJson('content/content-model.json')).toEqual(model)
		expect((await readdir(join(cwd, 'content/examples'))).sort()).toEqual([
			'_improve.json',
			'hero.json',
			'page.json',
		])
		expect(await readJson('content/examples/_improve.json')).toMatchObject({
			kind: 'flag',
			slug: 'sale',
			variants: { on: [{ _type: 'hero' }], off: [{ _type: 'hero' }] },
		})
		expect(opts.fetch).toHaveBeenCalledWith(
			'https://cms.test/api/management/v1/improve',
			{ headers: { Authorization: 'Bearer cms_m_x' } },
		)
		// With the project's package manager, and only the JS SDK, also in a
		// React project.
		expect(opts.run).toHaveBeenCalledWith(
			'pnpm',
			['add', '@obelism/content'],
			cwd,
		)
		const env = await readFile(join(cwd, '.env.example'), 'utf8')
		expect(env).toContain('CONTENT_DELIVERY_TOKEN=\n')
		expect(env).toContain('CONTENT_URL=https://cms.test')
		expect(env).not.toContain('cms_m_x')
	})

	it('leaves the improve block out while improve is off, or on an older CMS', async () => {
		for (const fetchMock of [
			cms({ enabled: false, sources: [] }),
			cms({ error: 'Not found' }, 404),
		]) {
			await runInitCommand({ ...options(fetchMock), install: false })
			expect(await readdir(join(cwd, 'content/examples'))).not.toContain(
				'_improve.json',
			)
		}
	})

	it('installs with npm by default, only what is missing, and not without a package.json', async () => {
		const opts = options(cms({ enabled: false, sources: [] }))
		await runInitCommand(opts)
		expect(opts.run).not.toHaveBeenCalled()
		expect(opts.log).toHaveBeenCalledWith(
			expect.stringContaining('No package.json here'),
		)

		await writeFile(join(cwd, 'package.json'), JSON.stringify({}))
		await runInitCommand(opts)
		expect(opts.run).toHaveBeenCalledWith(
			'npm',
			['install', '@obelism/content'],
			cwd,
		)

		opts.run.mockClear()
		await writeFile(
			join(cwd, 'package.json'),
			JSON.stringify({ dependencies: { '@obelism/content': '^0.2.0' } }),
		)
		await runInitCommand(opts)
		expect(opts.run).not.toHaveBeenCalled()
	})

	it('keeps an existing .env.example and adds only what it lacks', async () => {
		await writeFile(
			join(cwd, '.env.example'),
			'SITE_URL=\nCONTENT_DELIVERY_TOKEN=\n',
		)
		const opts = options(cms({ enabled: false, sources: [] }))
		await runInitCommand({ ...opts, install: false })
		await runInitCommand({ ...opts, install: false })

		const env = await readFile(join(cwd, '.env.example'), 'utf8')
		expect(env.startsWith('SITE_URL=\nCONTENT_DELIVERY_TOKEN=\n\n')).toBe(true)
		expect(env.match(/CONTENT_DELIVERY_TOKEN=/g)).toHaveLength(1)
		expect(env.match(/CONTENT_PREVIEW_TOKEN=/g)).toHaveLength(1)
	})

	it('fails when an install fails, after writing the files', async () => {
		await writeFile(join(cwd, 'package.json'), JSON.stringify({}))
		const opts = options(cms({ enabled: false, sources: [] }))
		opts.run.mockResolvedValue(1)
		await expect(runInitCommand(opts)).rejects.toThrow('failed (exit 1)')
		expect(await readJson('content/content-model.json')).toEqual(model)
	})
})
