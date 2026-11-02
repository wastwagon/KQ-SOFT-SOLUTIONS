/**
 * Write fully rendered HTML for public routes into dist/ (post-build).
 * Crawlers that do not execute JS still see headings and body copy.
 *
 * Usage: npm run build && npm run prerender
 * Requires Chromium: npm run test:e2e:install-browsers
 *
 * Not run in Docker by default (Playwright browser size); optional in CI.
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const port = Number(process.env.PRERENDER_PORT || 49174)
const base = `http://127.0.0.1:${port}`

const ROUTES = [
  {
    path: '/',
    wait: async (page) => {
      await page.getByRole('heading', { name: /Bank reconciliation for Ghana teams/i }).first().waitFor()
    },
  },
  {
    path: '/register',
    wait: async (page) => {
      await page.getByRole('link', { name: 'Terms' }).first().waitFor()
    },
  },
  {
    path: '/privacy',
    wait: async (page) => {
      await page.getByRole('heading', { name: 'Privacy Policy' }).first().waitFor()
    },
  },
  {
    path: '/terms',
    wait: async (page) => {
      await page.getByRole('heading', { name: 'Terms of Service' }).first().waitFor()
    },
  },
]

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: process.env }
    )
    let settled = false
    const tryReady = (chunk) => {
      const text = chunk.toString()
      if (settled) return
      if (/127\.0\.0\.1:\d+/.test(text) || /Local:\s*http/.test(text)) {
        settled = true
        resolve(() => {
          child.kill('SIGTERM')
        })
      }
    }
    child.stdout.on('data', tryReady)
    child.stderr.on('data', tryReady)
    child.on('error', reject)
    child.on('exit', (code) => {
      if (!settled) reject(new Error(`vite preview exited ${code ?? 'unknown'}`))
    })
    setTimeout(() => {
      if (!settled) {
        child.kill('SIGTERM')
        reject(new Error('Timed out waiting for vite preview'))
      }
    }, 120_000)
  })
}

function outPath(routePath) {
  if (routePath === '/') return join(dist, 'index.html')
  const segment = routePath.replace(/^\//, '')
  return join(dist, segment, 'index.html')
}

const stopPreview = await startPreview()

try {
  const launchOpts = process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {}
  const browser = await chromium.launch(launchOpts)
  for (const { path, wait } of ROUTES) {
    const page = await browser.newPage()
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 60_000 })
    await wait(page)
    const html = await page.content()
    const file = outPath(path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, html, 'utf8')
    console.log(`Prerendered ${path} → ${file}`)
    await page.close()
  }
  await browser.close()
} finally {
  stopPreview()
}
