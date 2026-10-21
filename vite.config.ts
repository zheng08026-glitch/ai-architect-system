import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const staticRuntimeFiles = [
  'app.js',
  'a2-plus.js',
  'a2-plus-presets.js',
  'a2-plus.css',
  'admin-monitor.js',
  'admin.html',
  'admin-page.js',
  'admin-members.js',
  'admin-access.js',
  'admin.css',
  'styles.css',
  'systems-ui.css',
  'assets/system-icons',
  'a10-site',
  'a2-3-editor.js',
  'a2-3-editor.html',
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
        cpSync(file, target, { recursive: true })
      }

      if (existsSync('assets/operation-guides')) {
        cpSync('assets/operation-guides', 'dist/assets/operation-guides', { recursive: true })
      }

      if (existsSync('assets/workflow-defaults')) {
        cpSync('assets/workflow-defaults', 'dist/assets/workflow-defaults', { recursive: true })
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
