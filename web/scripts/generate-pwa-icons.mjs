import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const svg = readFileSync(join(publicDir, 'kqsoft-icon.svg'))

for (const size of [192, 512]) {
  const out = join(publicDir, `pwa-icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(out)
  console.log('Wrote', out)
}
