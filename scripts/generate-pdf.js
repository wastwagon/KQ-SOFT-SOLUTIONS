#!/usr/bin/env node
/**
 * Generate USER_MANUAL.pdf from USER_MANUAL.md
 * Run: npm run manual:pdf
 */
import { mdToPdf } from 'md-to-pdf'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const input = join(root, 'USER_MANUAL.md')
const output = join(root, 'USER_MANUAL.pdf')

// Use system Chrome if available (set PUPPETEER_EXECUTABLE_PATH on Windows/Linux)
const chromePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : undefined)

async function main() {
  try {
    await mdToPdf(
      { path: input },
      {
        dest: output,
        launch_options: chromePath ? { executablePath: chromePath } : undefined,
        pdf_options: {
          format: 'A4',
          margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
          printBackground: true,
        },
      }
    )
    console.log('✓ USER_MANUAL.pdf created in project root')
  } catch (err) {
    console.error('PDF generation failed:', err.message)
    process.exit(1)
  }
}

main()
