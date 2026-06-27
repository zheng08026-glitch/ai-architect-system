import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const staticRuntimeFiles = [
  'app.js',
  'config.js',
  '_headers',
  '_redirects',
  'robots.txt',
]

function copyStaticRuntimeFiles() {
  return {
    name: 'copy-static-runtime-files',
    closeBundle() {
      for (const file of staticRuntimeFiles) {
        if (!existsSync(file)) continue
        const target = join('dist', file)
        mkdirSync(dirname(target), { recursive: true })
        cpSync(file, target)
      }

      if (existsSync('assets/operation-guides')) {
        cpSync('assets/operation-guides', 'dist/assets/operation-guides', { recursive: true })
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    copyStaticRuntimeFiles(),
  ],
})
