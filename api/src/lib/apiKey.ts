import crypto from 'crypto'

const KEY_PREFIX = 'brs_'
const KEY_LENGTH = 32
const HASH_ALGO = 'sha256'

export function generateApiKey(): string {
  const random = crypto.randomBytes(KEY_LENGTH).toString('hex')
  return `${KEY_PREFIX}${random}`
}

export function hashApiKey(key: string): string {
  return crypto.createHash(HASH_ALGO).update(key).digest('hex')
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 8)
}

export function verifyApiKey(plainKey: string, keyHash: string): boolean {
  const hash = hashApiKey(plainKey)
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(keyHash))
}
