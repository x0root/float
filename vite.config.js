import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'/config_terminal': path.resolve(__dirname, process.env.WEBVM_MODE == "github" ? 'config_github_terminal.js' : 'config_public_terminal.js'),
			"@leaningtech/cheerpx": process.env.CX_URL ? process.env.CX_URL : "@leaningtech/cheerpx"
		}
	},
	ssr: {
		noExternal: [/config_.*\.js$/]
	},
	build: {
		target: "es2022"
	},
	optimizeDeps: {
		esbuildOptions: {
			target: "es2022"
		}
	},
	server: {
		fs: {
			allow: ['.']
		}
	},
	plugins: [
		sveltekit(),
		viteStaticCopy({
			targets: [
				{ src: 'tower.ico', dest: '' },
				{ src: 'scrollbar.css', dest: '' },
				{ src: 'serviceWorker.js', dest: '' },
				{ src: 'login.html', dest: '' },
				{ src: 'assets/', dest: '' },
				{ src: 'documents/', dest: '' },
				{ src: 'disk-images/', dest: '' }
			]
		})
	]
});
