import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const base = '/JorrelWorksOut/'
export default defineConfig({
  plugins: [react(), {
    name: 'offline-app-shell',
    apply: 'build',
    async closeBundle() {
      const assets = (await readdir('dist/assets')).filter(name => name.endsWith('.js')).sort()
      const shell = [`${base}index.html`, `${base}manifest.json`, ...assets.map(name => `${base}assets/${name}`)]
      const index = await readFile('dist/index.html', 'utf8')
      const buildId = createHash('sha256').update(JSON.stringify(shell) + index).digest('hex').slice(0, 16)
      const worker = (await readFile('public/sw.js', 'utf8'))
        .replace('__BUILD_ID__', buildId)
        .replace('const APP_SHELL = []', `const APP_SHELL = ${JSON.stringify(shell)}`)
      await writeFile('dist/sw.js', worker)
    },
  }],
  base,
})
