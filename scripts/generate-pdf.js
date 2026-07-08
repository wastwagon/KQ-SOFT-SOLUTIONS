#!/usr/bin/env node
/**
 * Generate PDF manuals from markdown in the project root.
 * Run: npm run manual:pdf
 *      npm run mapping-manual:pdf
 */
import { mdToPdf } from 'md-to-pdf'
import { fileURLToPath } from 'url'
import { dirname, join, basename } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const MANUALS = {
  user: { input: 'USER_MANUAL.md', output: 'USER_MANUAL.pdf' },
  mapping: {
    input: 'docs/MAPPING_AND_MATCHING_MANUAL.md',
    output: 'MAPPING_AND_MATCHING_MANUAL.pdf',
  },
}

// Use system Chrome if available (set PUPPETEER_EXECUTABLE_PATH on Windows/Linux)
const chromePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : undefined)

async function generatePdf({ input, output }) {
  const inputPath = join(root, input)
  const outputPath = join(root, output)
  await mdToPdf(
    { path: inputPath },
    {
      dest: outputPath,
      launch_options: chromePath ? { executablePath: chromePath } : undefined,
      pdf_options: {
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true,
      },
    }
  )
  console.log(`✓ ${basename(outputPath)} created in project root`)
}

async function main() {
  const target = process.argv[2] || 'user'
  const manual = MANUALS[target]
  if (!manual) {
    console.error(`Unknown manual "${target}". Use: ${Object.keys(MANUALS).join(', ')}`)
    process.exit(1)
  }
  try {
    await generatePdf(manual)
  } catch (err) {
    console.error('PDF generation failed:', err.message)
    process.exit(1)
  }
}

main()
