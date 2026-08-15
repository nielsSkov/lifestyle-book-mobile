import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { afterEach, describe, it } from 'node:test'

import { createCredentialServer } from './server.mjs'

const servers = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  )
})

describe('Google credential service', () => {
  it('exchanges one authorization for renewable browser credentials', async () => {
    const tokenRequests = []
    const googleRequest = async (url, options) => {
      tokenRequests.push({ url, body: new URLSearchParams(options.body) })
      if (url.endsWith('/token') && tokenRequests.length === 1) {
        return Response.json({
          access_token: 'first-access',
          refresh_token: 'refresh-proof',
          expires_in: 3600,
        })
      }
      if (url.endsWith('/token')) {
        return Response.json({ access_token: 'renewed-access', expires_in: 3600 })
      }
      return new Response(null, { status: 200 })
    }
    const configuration = testConfiguration()
    const { server, origin } = await listen(configuration, googleRequest)
    servers.push(server)

    const start = await fetch(
      `${origin}/oauth/start?return_url=${encodeURIComponent('https://app.example/')}`,
      { redirect: 'manual' },
    )
    assert.equal(start.status, 302)
    const authorization = new URL(start.headers.get('location'))
    assert.equal(authorization.origin, 'https://accounts.google.com')
    assert.equal(authorization.searchParams.get('access_type'), 'offline')
    assert.equal(authorization.searchParams.get('prompt'), 'consent')
    assert.match(authorization.searchParams.get('scope'), /drive\.file/)

    const callback = await fetch(
      `${origin}/oauth/callback?code=proof-code&state=${encodeURIComponent(authorization.searchParams.get('state'))}`,
      { redirect: 'manual' },
    )
    assert.equal(callback.status, 302)
    const returned = new URL(callback.headers.get('location'))
    assert.equal(returned.origin, 'https://app.example')
    const credential = new URLSearchParams(returned.hash.slice(1)).get('google-drive-credential')
    assert.ok(credential)

    const renewal = await fetch(`${origin}/token`, {
      method: 'POST',
      headers: { origin: 'https://app.example', 'content-type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    assert.equal(renewal.status, 200)
    assert.deepEqual(await renewal.json(), { accessToken: 'renewed-access', expiresIn: 3600 })
    assert.equal(tokenRequests[0].body.get('grant_type'), 'authorization_code')
    assert.equal(tokenRequests[1].body.get('grant_type'), 'refresh_token')
    assert.equal(tokenRequests[1].body.get('refresh_token'), 'refresh-proof')
  })

  it('rejects unapproved application origins', async () => {
    const configuration = testConfiguration()
    const { server, origin } = await listen(configuration, fetch)
    servers.push(server)

    const response = await fetch(`${origin}/token`, {
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'stolen' }),
    })

    assert.equal(response.status, 403)
  })
})

function testConfiguration() {
  return {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    publicUrl: 'https://broker.example',
    returnUrls: new Set(['https://app.example/']),
    allowedOrigins: new Set(['https://app.example']),
    encryptionKey: randomBytes(32),
  }
}

async function listen(configuration, request) {
  const server = createCredentialServer(configuration, request)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  return { server, origin: `http://127.0.0.1:${address.port}` }
}
