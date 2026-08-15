import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { describe, it } from 'node:test'

import { parseEncryptionKey, seal, unseal } from './credentials.mjs'

describe('sealed credentials', () => {
  it('round trips an authenticated payload', () => {
    const key = randomBytes(32)
    const sealed = seal({ kind: 'credential', refreshToken: 'secret' }, key)

    assert.deepEqual(unseal(sealed, key), {
      kind: 'credential',
      refreshToken: 'secret',
    })
  })

  it('rejects tampering', () => {
    const key = randomBytes(32)
    const sealed = seal({ kind: 'credential', refreshToken: 'secret' }, key)
    const tampered = Buffer.from(sealed, 'base64url')
    tampered[tampered.length - 1] ^= 1

    assert.throws(() => unseal(tampered.toString('base64url'), key))
  })

  it('requires exactly 32 bytes of key material', () => {
    assert.equal(parseEncryptionKey(randomBytes(32).toString('base64')).length, 32)
    assert.throws(() => parseEncryptionKey(randomBytes(16).toString('base64')))
  })
})
