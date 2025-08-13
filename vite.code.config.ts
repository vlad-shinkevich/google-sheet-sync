import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src'),
		},
	},
	build: {
		outDir: 'dist',
		emptyOutDir: false,
		rollupOptions: {
			input: resolve(__dirname, 'src/code.ts'),
			output: {
				format: 'iife',
				entryFileNames: 'code.js',
			},
		},
		target: 'es2018',
		minify: true,
	},
})


