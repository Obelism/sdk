import { defineConfig } from 'tsup'

export default defineConfig({
	format: ['esm'],
	entry: ['./src/index.ts'],
	outDir: 'public',
	dts: false,
	shims: true,
	skipNodeModulesBundle: true,
	clean: true,
	target: 'esnext',
	platform: 'browser',
	minify: true,
	bundle: true,
	// https://github.com/egoist/tsup/issues/619
	noExternal: [/(.*)/],
	splitting: false,
})
