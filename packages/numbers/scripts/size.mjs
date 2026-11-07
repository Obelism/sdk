// The script-tag build is downloaded by every visitor of every site with
// numbers on it: keep it from growing unnoticed. Run after `npm run build`.
import { readFileSync } from 'node:fs'
import { brotliCompressSync, constants } from 'node:zlib'

const MINIFIED_BUDGET = 8.5 * 1024
const BROTLI_BUDGET = 3.5 * 1024

const file = new URL('../dist/script.global.js', import.meta.url)
let source
try {
	source = readFileSync(file)
} catch {
	console.error('dist/script.global.js is missing: run `npm run build` first.')
	process.exit(1)
}

const minified = source.length
const brotli = brotliCompressSync(source, {
	params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
}).length

const report = (label, size, budget) => {
	const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`
	const over = size > budget
	console.log(`${over ? '✖' : '✔'} ${label}: ${kb(size)} of ${kb(budget)}`)
	return over
}

const over = [
	report('minified', minified, MINIFIED_BUDGET),
	report('brotli', brotli, BROTLI_BUDGET),
].some(Boolean)

if (over) {
	console.error(
		'dist/script.global.js is over its budget: trim it, or raise the budget in scripts/size.mjs with a reason.',
	)
	process.exit(1)
}
