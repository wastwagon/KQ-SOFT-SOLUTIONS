/**
 * Object storage for uploads — local disk by default; S3-compatible when configured.
 *
 * Env:
 *   STORAGE_BACKEND=local|s3   (default local)
 *   UPLOAD_DIR=...             local root (also used as local cache when S3)
 *   S3_BUCKET=
 *   S3_REGION=auto
 *   S3_ENDPOINT=               optional (MinIO / R2 / Spaces)
 *   S3_ACCESS_KEY_ID=
 *   S3_SECRET_ACCESS_KEY=
 *   S3_FORCE_PATH_STYLE=1      for MinIO
 *   S3_PUBLIC_BASE_URL=        optional CDN/public URL prefix for branding
 *
 * DB filepath values:
 *   local: absolute or relative path under UPLOAD_DIR
 *   s3:    "s3://<key>" (key may include branding/… prefix)
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { logger } from '../middleware/logging.js'

export type StorageBackend = 'local' | 's3'

const uploadRoot = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
const cacheRoot = () => path.join(uploadRoot(), '.s3-cache')

export function getStorageBackend(): StorageBackend {
  const v = (process.env.STORAGE_BACKEND || 'local').trim().toLowerCase()
  return v === 's3' ? 's3' : 'local'
}

export function isS3StorageKey(filepath: string): boolean {
  return filepath.startsWith('s3://')
}

export function storageKeyFromPath(filepath: string): string {
  if (isS3StorageKey(filepath)) return filepath.slice('s3://'.length)
  return filepath
}

let s3Client: S3Client | null = null

function getS3(): S3Client {
  if (s3Client) return s3Client
  const region = process.env.S3_REGION || 'auto'
  const endpoint = (process.env.S3_ENDPOINT || '').trim() || undefined
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === '1' || process.env.S3_FORCE_PATH_STYLE === 'true'
  s3Client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  })
  return s3Client
}

function requireBucket(): string {
  const b = (process.env.S3_BUCKET || '').trim()
  if (!b) throw new Error('S3_BUCKET is required when STORAGE_BACKEND=s3')
  return b
}

/** Ensure local upload dirs exist (always — multer + cache). */
export function ensureLocalUploadDirs(): void {
  const root = uploadRoot()
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
  const branding = path.join(root, 'branding')
  if (!fs.existsSync(branding)) fs.mkdirSync(branding, { recursive: true })
  if (getStorageBackend() === 's3') {
    const cache = cacheRoot()
    if (!fs.existsSync(cache)) fs.mkdirSync(cache, { recursive: true })
  }
}

/**
 * After multer writes a local file, promote to configured backend.
 * Returns the filepath value to store in the DB.
 */
export async function persistUploadedFile(
  localPath: string,
  opts?: { keyPrefix?: string; contentType?: string }
): Promise<string> {
  if (getStorageBackend() !== 's3') {
    return localPath
  }
  const bucket = requireBucket()
  const base = path.basename(localPath)
  const key = `${opts?.keyPrefix ? `${opts.keyPrefix.replace(/\/$/, '')}/` : ''}${base}`
  const body = await fsp.readFile(localPath)
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: opts?.contentType,
    })
  )
  try {
    await fsp.unlink(localPath)
  } catch {
    /* keep local if unlink fails */
  }
  return `s3://${key}`
}

/** Resolve a DB filepath to a local readable path (downloads from S3 into cache if needed). */
export async function resolveReadablePath(filepath: string): Promise<string> {
  if (!isS3StorageKey(filepath)) {
    if (path.isAbsolute(filepath)) return filepath
    return path.join(uploadRoot(), filepath)
  }
  const key = storageKeyFromPath(filepath)
  const local = path.join(cacheRoot(), key.replace(/[\\/]/g, '__'))
  if (fs.existsSync(local)) return local
  await fsp.mkdir(path.dirname(local), { recursive: true })
  const bucket = requireBucket()
  const out = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const bytes = await streamToBuffer(out.Body)
  await fsp.writeFile(local, bytes)
  return local
}

/** Sync helper for legacy call sites — prefer resolveReadablePath in async code. */
export function resolveLocalPathSync(filepath: string): string {
  if (isS3StorageKey(filepath)) {
    const key = storageKeyFromPath(filepath)
    const cached = path.join(cacheRoot(), key.replace(/[\\/]/g, '__'))
    if (fs.existsSync(cached)) return cached
    throw new Error(`S3 object not cached locally yet: ${key}. Use resolveReadablePath().`)
  }
  if (path.isAbsolute(filepath)) return filepath
  return path.join(uploadRoot(), filepath)
}

export async function deleteStoredFile(filepath: string): Promise<void> {
  if (isS3StorageKey(filepath)) {
    const key = storageKeyFromPath(filepath)
    try {
      await getS3().send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }))
    } catch (err) {
      logger.warn({ err, key }, 'storage: S3 delete failed')
    }
    const cached = path.join(cacheRoot(), key.replace(/[\\/]/g, '__'))
    try {
      if (fs.existsSync(cached)) await fsp.unlink(cached)
    } catch {
      /* ignore */
    }
    return
  }
  const full = path.isAbsolute(filepath) ? filepath : path.join(uploadRoot(), filepath)
  try {
    if (fs.existsSync(full)) await fsp.unlink(full)
  } catch (err) {
    logger.warn({ err, full }, 'storage: local delete failed')
  }
}

export async function storedFileExists(filepath: string): Promise<boolean> {
  if (isS3StorageKey(filepath)) {
    try {
      await getS3().send(new HeadObjectCommand({ Bucket: requireBucket(), Key: storageKeyFromPath(filepath) }))
      return true
    } catch {
      return false
    }
  }
  const full = path.isAbsolute(filepath) ? filepath : path.join(uploadRoot(), filepath)
  return fs.existsSync(full)
}

/** Public URL for branding logo when using S3 + S3_PUBLIC_BASE_URL; else null (use API proxy). */
export function publicUrlForStoredPath(filepath: string): string | null {
  const base = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '')
  if (!base || !isS3StorageKey(filepath)) return null
  return `${base}/${storageKeyFromPath(filepath)}`
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  const stream = body as AsyncIterable<Uint8Array>
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/** Unique temp path under upload root (for rare download-then-process flows). */
export function tempUploadPath(ext = '.bin'): string {
  ensureLocalUploadDirs()
  return path.join(uploadRoot(), `tmp-${randomUUID()}${ext}`)
}
