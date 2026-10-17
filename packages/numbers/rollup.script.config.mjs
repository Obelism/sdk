import { nodeResolve } from '@rollup/plugin-node-resolve'
import { swc, minify } from 'rollup-plugin-swc3'

// The client as one script tag (src/scriptEntry.ts): what numbers serves as
// /script.js. bunchee builds the package's exports; this builds the one
// browser file next to them.
export default {
	input: 'src/scriptEntry.ts',
	output: {
		file: 'dist/script.global.js',
		format: 'iife',
		banner:
			'/*! Obelism numbers (@obelism/numbers-sdk), MIT. https://numbers.obelism.studio */',
	},
	plugins: [
		nodeResolve({ extensions: ['.ts', '.js'] }),
		swc({ jsc: { target: 'es2020' } }),
		minify({ compress: true, mangle: true, format: { comments: 'some' } }),
	],
}
