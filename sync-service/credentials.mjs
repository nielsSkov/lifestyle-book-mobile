import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const algorithm = 'aes-256-gcm'
const ivLength = 12
const tagLength = 16

export function parseEncryptionKey(value) {
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32) throw new Error('CREDENTIAL_ENCRYPTION_KEY must contain 32 base64 bytes')
  return key
}

export function seal(payload, key) {
  const iv = randomBytes(ivLength)
  const cipher = createCipheriv(algorithm, key, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

export function unseal(value, key) {
  const encoded = Buffer.from(value, 'base64url')
  if (encoded.length <= ivLength + tagLength) throw new Error('Invalid sealed credential')

  const iv = encoded.subarray(0, ivLength)
  const tag = encoded.subarray(ivLength, ivLength + tagLength)
  const encrypted = encoded.subarray(ivLength + tagLength)
  const decipher = createDecipheriv(algorithm, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}
