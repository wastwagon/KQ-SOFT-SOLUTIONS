import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Production image has dist/ only; local dev uses src/ via tsx. */
export async function importPlanFeatures() {
  const distPath = join(here, '..', 'dist', 'config', 'planFeatures.js')
  if (existsSync(distPath)) {
    return import('../dist/config/planFeatures.js')
  }
  return import('../src/config/planFeatures.js')
}
