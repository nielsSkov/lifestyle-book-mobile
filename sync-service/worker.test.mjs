import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { describe, it } from 'node:test'

import { handleRequest } from './worker.mjs'

describe('Google credential Worker', () => {
  it('exchanges one authorization for renewable browser credentials', async () => {
    const workerEnvironment = environment()
    const tokenRequests = []
    const googleRequest = async (url, options) => {
      tokenRequests.push({ url, body: new URLSearchParams(options.body) })
      if (tokenRequests.length === 1) {
        return Response.json({ access_token: 'first-access', refresh_token: 'refresh-proof' })
      }
      return Response.json({ access_token: 'renewed-access', expires_in: 3600 })
    }

    const start = await handleRequest(
      new Request('https://broker.example/oauth/start?return_url=https%3A%2F%2Fapp.example%2F'),
      workerEnvironment,
      googleRequest,
    )
    const authorization = new URL(start.headers.get('location'))
    assert.equal(authorization.searchParams.get('access_type'), 'offline')
    assert.match(authorization.searchParams.get('scope'), /drive\.file/)

    const callback = await handleRequest(
      new Request(
        `https://broker.example/oauth/callback?code=proof&state=${encodeURIComponent(authorization.searchParams.get('state'))}`,
      ),
      workerEnvironment,
      googleRequest,
    )
    const returned = new URL(callback.headers.get('location'))
    const credential = new URLSearchParams(returned.hash.slice(1)).get('google-drive-credential')
    assert.ok(credential)

    const renewal = await handleRequest(
      new Request('https://broker.example/token', {
        method: 'POST',
        headers: { origin: 'https://app.example', 'content-type': 'application/json' },
        body: JSON.stringify({ credential }),
      }),
      workerEnvironment,
      googleRequest,
    )
    assert.deepEqual(await renewal.json(), {
      accessToken: 'renewed-access',
      expiresIn: 3600,
    })
    assert.equal(tokenRequests[0].body.get('grant_type'), 'authorization_code')
    assert.equal(tokenRequests[1].body.get('grant_type'), 'refresh_token')
  })

  it('rejects unapproved application origins', async () => {
    const response = await handleRequest(
      new Request('https://broker.example/token', {
        method: 'POST',
        headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
        body: JSON.stringify({ credential: 'stolen' }),
      }),
      environment(),
    )

    assert.equal(response.status, 403)
  })
})

function environment() {
  return {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    ALLOWED_RETURN_URLS: 'https://app.example/',
    CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  }
}
