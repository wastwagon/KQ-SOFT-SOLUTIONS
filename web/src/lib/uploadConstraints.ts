/**
 * Client-side limits for project document uploads.
 * Defaults mirror `api/src/config/importLimits.ts`.
 * Set `VITE_MAX_UPLOAD_SIZE_MB` if the API env differs.
 */
import { MAX_UPLOAD_SIZE_MB } from './importLimits'

const safeMb = MAX_UPLOAD_SIZE_MB

export const MAX_PROJECT_DOCUMENT_UPLOAD_BYTES = safeMb * 1024 * 1024

export const PROJECT_DOCUMENT_ALLOWED_EXTENSIONS = [
  '.xlsx',
  '.xls',
  '.xlsm',
  '.csv',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.tiff',
  '.tif',
  '.bmp',
] as const

export function projectDocumentUploadExtension(filename: string): string {
  const lower = filename.toLowerCase()
  const dot = lower.lastIndexOf('.')
  return dot >= 0 ? lower.slice(dot) : ''
}

export function validateProjectUploadFiles(
  files: File[]
): { ok: true } | { ok: false; message: string } {
  const allowed = new Set(PROJECT_DOCUMENT_ALLOWED_EXTENSIONS)
  for (const f of files) {
    const ext = projectDocumentUploadExtension(f.name)
    if (!allowed.has(ext as (typeof PROJECT_DOCUMENT_ALLOWED_EXTENSIONS)[number])) {
      return {
        ok: false,
        message: `"${f.name}" is not an allowed type. Use: ${PROJECT_DOCUMENT_ALLOWED_EXTENSIONS.join(', ')}.`,
      }
    }
    if (f.size > MAX_PROJECT_DOCUMENT_UPLOAD_BYTES) {
      return {
        ok: false,
        message: `"${f.name}" is larger than the ${safeMb} MB per-file limit.`,
      }
    }
  }
  return { ok: true }
}

export const PROJECT_UPLOAD_LIMITS_SUMMARY = `Up to ${safeMb} MB per file. Allowed: ${PROJECT_DOCUMENT_ALLOWED_EXTENSIONS.join(', ')}.`
