const ivLength = 12

export function parseEncryptionKey(value) {
  const key = fromBase64(value)
  if (key.length !== 32) throw new Error('CREDENTIAL_ENCRYPTION_KEY must contain 32 base64 bytes')
  return key
}

export async function seal(payload, key) {
  const iv = crypto.getRandomValues(new Uint8Array(ivLength))
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      new TextEncoder().encode(JSON.stringify(payload)),
    ),
  )
  return toBase64Url(concatenate(iv, encrypted))
}

export async function unseal(value, key) {
  const encoded = fromBase64Url(value)
  if (encoded.length <= ivLength + 16) throw new Error('Invalid sealed credential')

  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: encoded.slice(0, ivLength) },
    cryptoKey,
    encoded.slice(ivLength),
  )
  return JSON.parse(new TextDecoder().decode(decrypted))
}

function concatenate(left, right) {
  const value = new Uint8Array(left.length + right.length)
  value.set(left)
  value.set(right, left.length)
  return value
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function fromBase64Url(value) {
  return fromBase64(value.replaceAll('-', '+').replaceAll('_', '/'))
}

function toBase64Url(value) {
  return btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}
