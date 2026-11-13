// The CMS's docs/adr/0035: one copy of the site's half, beside the example.
export const IMPROVE_GUIDE = `# Rendering the improve block

\`_improve.json\` is what the delivery API answers for the improve block: one
list of blocks per option of an Obelism Improve test or flag. Editors add,
run and end these tests without you, so set the site up once and a page can
carry any number of tests without a build, a route or a deploy per test.

Written by \`content init\`; the guide is
https://content.obelism.studio/docs/guides/ab-tests.

## Rendered per request

If the page is rendered per request, pick the variant while you render and
skip the rest of this file:

\`\`\`ts
import { isImproveBlock, pickImproveVariant } from '@obelism/content'

// \`improve\` is Improve's server SDK (@obelism/improve-sdk/server) with its
// datafile loaded; \`visitorId\` its cookie on the request.
const blocks = fields.body.flatMap((block) => {
	if (!isImproveBlock(block)) return [block]
	const option =
		block.kind === 'flag'
			? improve.getFlagValue(block.slug, visitorId, userAgent, { country })
			: improve.getTestValue(block.slug, visitorId, userAgent, { country })
	return pickImproveVariant(block, option)
})
\`\`\`

## Prerendered: every variant in the page

A page built once (static, ISR) is the same bytes for every visitor. It
carries every variant, tagged, and a script in the head shows one before the
first paint. Five pieces, set up once.

### 1. The block renderer

The branch of your block renderer that meets \`_improve\`. \`mode\` is stamped
when the entry is published: \`instant\` puts every variant in the markup,
\`after-load\` only the \`fallback\` one, with the others as JSON beside it.

\`\`\`tsx
import { isImproveBlock, type Block, type ImproveBlock } from '@obelism/content'

import { AfterLoadVariants } from './AfterLoadVariants'

export const BlockRenderer = ({ block }: { block: Block }) => {
	if (isImproveBlock(block)) {
		return block.mode === 'after-load' ? (
			<AfterLoadVariants block={block} />
		) : (
			<ImproveVariants block={block} />
		)
	}
	const Component = components[block._type]
	return Component ? <Component block={block} /> : null
}

const ImproveVariants = ({ block }: { block: ImproveBlock }) => (
	<>
		{Object.entries(block.variants ?? {}).map(([option, blocks]) => (
			<div key={option} data-ob-imp={block.slug} data-ob-opt={option}>
				{blocks.map((child) => (
					<BlockRenderer block={child} key={child._uid} />
				))}
			</div>
		))}
	</>
)
\`\`\`

The element around a variant gets \`display: contents\` from the style below,
so a block in a grid or a flex row keeps its place.

### 2. The head

The instant tests of the page, their option lists, a classic script and one
style rule per test, all in \`<head>\` before the body. Never \`type="module"\`,
\`defer\` or \`async\`: those run after the variants are painted. Allow the
script in a CSP by its hash; Cloudflare's Rocket Loader needs
\`data-cfasync="false"\` on it.

\`\`\`ts
import type { ImproveBlock } from '@obelism/content'

const SAFE = /^[a-z0-9-]+$/

// Every improve block in an entry, however deep.
export const improveBlocks = (value: unknown, found: ImproveBlock[] = []) => {
	if (Array.isArray(value)) value.forEach((item) => improveBlocks(item, found))
	else if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>
		if (record._type === '_improve') found.push(value as ImproveBlock)
		for (const child of Object.values(record)) improveBlocks(child, found)
	}
	return found
}

// The meta's content and the style, from the page's instant placements.
// Nothing (and no script) when it has none.
export const improveHead = (entry: unknown) => {
	const tests = new Map<string, { options: string[]; fallback: string }>()
	for (const block of improveBlocks(entry)) {
		if (block.mode === 'after-load' || !SAFE.test(block.slug)) continue
		const options = Object.keys(block.variants ?? {}).filter((option) =>
			SAFE.test(option),
		)
		const fallback =
			block.fallback && options.includes(block.fallback)
				? block.fallback
				: options[0]
		if (fallback) tests.set(block.slug, { options, fallback })
	}
	if (tests.size === 0) return null

	const meta = JSON.stringify(
		Object.fromEntries([...tests].map(([slug, { options }]) => [slug, options])),
	)
	const hidden = [...tests].flatMap(([slug, { options, fallback }]) => [
		\`html:not([data-imp-\${slug}]) [data-ob-imp="\${slug}"]:not([data-ob-opt="\${fallback}"])\`,
		...options.map(
			(option) =>
				\`html[data-imp-\${slug}="\${option}"] [data-ob-imp="\${slug}"]:not([data-ob-opt="\${option}"])\`,
		),
	])
	const style = \`[data-ob-imp]{display:contents}\\n\${hidden.join(',\\n')}{display:none}\`
	return { meta, style }
}
\`\`\`

\`\`\`html
<meta name="obelism-improve" content='{"homepage-hero":["control","variation"]}' />
<script data-cfasync="false">
	;(function () {
		var meta = document.querySelector('meta[name="obelism-improve"]')
		if (!meta) return
		var tests = JSON.parse(meta.content)
		var cookies = document.cookie.split('; ')
		for (var slug in tests) {
			for (var i = 0; i < cookies.length; i++) {
				if (cookies[i].indexOf(slug + '=') !== 0) continue
				var value = cookies[i].slice(slug.length + 1)
				if (tests[slug].indexOf(value) > -1)
					document.documentElement.setAttribute('data-imp-' + slug, value)
			}
		}
	})()
</script>
<style>
	/* improveHead(entry).style */
</style>
\`\`\`

In React, \`improveHead(entry)\` gives the meta's \`content\` and the style's
text: \`<meta name="obelism-improve" content={head.meta} />\`, then the script
as a string in \`<script dangerouslySetInnerHTML={{ __html: RUNTIME }} />\`,
then \`<style dangerouslySetInnerHTML={{ __html: head.style }} />\`. The slugs
and options in both passed \`SAFE\`, so neither can close its tag.

The option list matters: a cookie can name an option the block no longer
has, and without the check every variant of that block would hide. Only the
variants that lost are ever hidden; the one that shows keeps your styles.

### 3. The edge

An edge function in front of the page decides every active test and flag
before the page is served, and keeps the cookies a visitor already has.
Without one, every visitor gets the fallback and the test measures nothing.

\`\`\`ts
import { ImproveServerSDK } from '@obelism/improve-sdk/server'

// Per request: the instance keeps its datafile for as long as it lives.
const improve = new ImproveServerSDK({
	organizationId: 'org_…',
	spaceId: 'space_…',
	environment: 'production',
	token: env.IMPROVE_TOKEN,
})
await improve.fetchConfig()

const { cookies } = improve.seedTestCookies({
	cookieHeader: request.headers.get('Cookie'),
	userAgent: request.headers.get('User-Agent') ?? '',
	geo: { country: request.headers.get('CF-IPCountry') ?? undefined },
})
for (const { header } of cookies) response.headers.append('Set-Cookie', header)
\`\`\`

Leave bots out (they get the fallback and no cookie), never send
\`Vary: Cookie\`, and keep caching the page itself: only the cookies are per
visitor.

### 4. The exposure

Results count exposures, and nothing has recorded one: the page decided
nothing. After paint, ask Improve's client SDK once per test the edge
decided; it reads the cookie, records the exposure and does not bucket again.

\`\`\`ts
// improveExposure.ts
import type { ImproveBlock } from '@obelism/content'
import { ImproveClientSDK } from '@obelism/improve-sdk/client'

let ready: Promise<ImproveClientSDK> | undefined
const recorded = new Set<string>()

// Once per test, however many placements the page has.
export const recordExposure = async ({ slug, kind }: ImproveBlock) => {
	if (recorded.has(slug)) return
	recorded.add(slug)
	ready ??= (async () => {
		const improve = new ImproveClientSDK({
			organizationId: 'org_…',
			spaceId: 'space_…',
			environment: 'production',
		})
		await improve.fetchConfig()
		return improve
	})()
	const improve = await ready
	if (kind === 'flag') improve.getFlagValue(slug)
	else improve.getTestValue(slug)
}
\`\`\`

\`\`\`tsx
'use client'
import { useEffect } from 'react'
import type { ImproveBlock } from '@obelism/content'

import { recordExposure } from './improveExposure'

// Once per page, with improveBlocks(entry).
export const ImproveExposures = ({ blocks }: { blocks: ImproveBlock[] }) => {
	useEffect(() => {
		for (const block of blocks) {
			if (block.mode === 'after-load') continue
			if (document.documentElement.hasAttribute(\`data-imp-\${block.slug}\`))
				recordExposure(block)
		}
	}, [blocks])
	return null
}
\`\`\`

### 5. After-load placements

Below the page type's fold, publishing stamps \`mode: "after-load"\`: the
fallback variant is markup, the others JSON in the page, swapped in on mount.
No second variant's markup or images, and no head script for a page that has
only these. It needs a block renderer that runs in the browser.

\`\`\`tsx
'use client'
import { useEffect, useState } from 'react'
import type { Block, ImproveBlock } from '@obelism/content'

import { BlockRenderer } from './BlockRenderer'
import { recordExposure } from './improveExposure'

// \`<\` escaped, so a block's text can't close the script.
const json = (value: unknown) =>
	JSON.stringify(value).replace(/</g, '\\\\u003c')

const readCookie = (name: string) =>
	document.cookie
		.split('; ')
		.find((row) => row.startsWith(\`\${name}=\`))
		?.slice(name.length + 1)

export const AfterLoadVariants = ({ block }: { block: ImproveBlock }) => {
	const variants = block.variants ?? {}
	const fallback =
		block.fallback && variants[block.fallback]
			? block.fallback
			: Object.keys(variants)[0]
	const others = Object.fromEntries(
		Object.entries(variants).filter(([option]) => option !== fallback),
	)
	const [shown, setShown] = useState<{ option: string | undefined; blocks: Block[] }>({
		option: fallback,
		blocks: (fallback && variants[fallback]) || [],
	})

	useEffect(() => {
		const option = readCookie(block.slug)
		if (!option) return
		const script = document.querySelector(
			\`script[data-ob-variants="\${CSS.escape(block.slug)}"]\`,
		)
		const arms: Record<string, Block[]> =
			option === fallback ? variants : JSON.parse(script?.textContent || '{}')
		// The cookie is the visitor's to edit: only an option the block has.
		const blocks = Object.hasOwn(arms, option) ? arms[option] : undefined
		if (!Array.isArray(blocks)) return
		setShown({ option, blocks })
		document.documentElement.setAttribute(\`data-imp-\${block.slug}\`, option)
		recordExposure(block)
	}, [block.slug])

	return (
		<>
			<div
				data-ob-imp={block.slug}
				data-ob-opt={shown.option}
				style={{ display: 'contents' }}
			>
				{shown.blocks.map((child) => (
					<BlockRenderer block={child} key={child._uid} />
				))}
			</div>
			<script
				type="application/json"
				data-ob-variants={block.slug}
				dangerouslySetInnerHTML={{ __html: json(others) }}
			/>
		</>
	)
}
\`\`\`

Its own \`display: contents\` is inline: a page with only after-load
placements has no head style. The exposure is recorded when the swap lands, not before: a visitor who never
gets the variant is not counted as seeing it.

## Ending a test

Pausing it in Improve only stops new assignments. In Content, **Keep a
variant** on the block replaces it with that option's blocks; publishing the
page ends the test for everyone.
`
