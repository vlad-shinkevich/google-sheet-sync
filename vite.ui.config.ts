import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

export default defineConfig({
	plugins: [react(), viteSingleFile()],
	base: '',
	resolve: {
    alias: {
            '@': path.resolve(__dirname, 'src'),
        },
	},
	build: {
		outDir: 'dist',
		emptyOutDir: false,
		rollupOptions: {
            input: path.resolve(__dirname, 'src/ui/ui.html'),
			output: {
				entryFileNames: 'ui.js',
				assetFileNames: 'ui.[ext]',
			},
		},
		target: 'es2018',
	},
})


