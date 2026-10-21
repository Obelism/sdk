import { nodeResolve } from '@rollup/plugin-node-resolve'
import { swc, minify } from 'rollup-plugin-swc3'

// The bridge as one script tag (src/bridgeScript.ts): what the CMS serves
// as /bridge.js. bunchee builds the package's exports; this builds the one
// browser file next to them.
export default {
	input: 'src/bridgeScript.ts',
	output: {
		file: 'dist/bridge.global.js',
		format: 'iife',
		banner:
			'/*! Obelism Content bridge (@obelism/content), MIT. https://content.obelism.studio/docs/guides/canvas */',
	},
	plugins: [
		nodeResolve({ extensions: ['.ts', '.js'] }),
		swc({ jsc: { target: 'es2020' } }),
		minify({ compress: true, mangle: true, format: { comments: 'some' } }),
	],
}
