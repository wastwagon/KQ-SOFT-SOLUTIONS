/**
 * Build WebP companions for marketing JPEGs (smaller LCP / below-fold bytes).
 * Run via prebuild alongside PWA icons.
 */
import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const marketingDir = join(root, 'public', 'marketing')

const QUALITY = 82

for (const name of readdirSync(marketingDir)) {
  if (!name.endsWith('.jpg') && !name.endsWith('.jpeg')) continue
  const input = join(marketingDir, name)
  const out = join(marketingDir, name.replace(/\.jpe?g$/i, '.webp'))
  await sharp(input).webp({ quality: QUALITY, effort: 4 }).toFile(out)
  const outStat = await import('node:fs').then((fs) => fs.statSync(out))
  const inStat = await import('node:fs').then((fs) => fs.statSync(input))
  console.log(
    `Wrote ${out} (${Math.round(outStat.size / 1024)} KB, jpeg ${Math.round(inStat.size / 1024)} KB)`
  )
}
