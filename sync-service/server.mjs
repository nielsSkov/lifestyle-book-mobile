import { createServer } from 'node:http'

import { parseEncryptionKey, seal, unseal } from './credentials.mjs'

const googleAuthorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
const googleTokenUrl = 'https://oauth2.googleapis.com/token'
const googleRevokeUrl = 'https://oauth2.googleapis.com/revoke'
const stateLifetimeMs = 10 * 60 * 1000

export function loadConfiguration(environment = process.env) {
  const required = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'PUBLIC_URL',
    'ALLOWED_RETURN_URLS',
    'CREDENTIAL_ENCRYPTION_KEY',
  ]
  for (const name of required) {
    if (!environment[name]) throw new Error(`${name} is required`)
  }

  const returnUrls = new Set(
    environment.ALLOWED_RETURN_URLS.split(',').map((value) => new URL(value.trim()).href),
  )
  return {
    clientId: environment.GOOGLE_CLIENT_ID,
    clientSecret: environment.GOOGLE_CLIENT_SECRET,
    publicUrl: new URL(environment.PUBLIC_URL).origin,
    returnUrls,
    allowedOrigins: new Set([...returnUrls].map((value) => new URL(value).origin)),
    encryptionKey: parseEncryptionKey(environment.CREDENTIAL_ENCRYPTION_KEY),
  }
}

export function createCredentialServer(configuration, request = fetch) {
  return createServer(async (incoming, response) => {
    try {
      const url = new URL(incoming.url, configuration.publicUrl)

      if (incoming.method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, { status: 'ok' })
      }

      if (incoming.method === 'GET' && url.pathname === '/oauth/start') {
        const returnUrl = new URL(url.searchParams.get('return_url') ?? '').href
        if (!configuration.returnUrls.has(returnUrl))
          return sendJson(response, 400, { error: 'Invalid return URL' })

        const state = seal(
          { kind: 'oauth-state', returnUrl, expiresAt: Date.now() + stateLifetimeMs },
          configuration.encryptionKey,
        )
        const authorization = new URL(googleAuthorizationUrl)
        authorization.search = new URLSearchParams({
          client_id: configuration.clientId,
          redirect_uri: `${configuration.publicUrl}/oauth/callback`,
          response_type: 'code',
          scope: 'openid email https://www.googleapis.com/auth/drive.file',
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true',
          state,
        }).toString()
        response.writeHead(302, { location: authorization.href, 'cache-control': 'no-store' })
        return response.end()
      }

      if (incoming.method === 'GET' && url.pathname === '/oauth/callback') {
        const state = readState(url.searchParams.get('state'), configuration)
        if (url.searchParams.has('error'))
          return redirectWithError(response, state.returnUrl, 'Google access was not granted')

        const tokens = await exchangeCode(url.searchParams.get('code'), configuration, request)
        if (!tokens.refresh_token) throw new Error('Google did not return a refresh token')
        const credential = seal(
          { kind: 'google-drive-credential', refreshToken: tokens.refresh_token },
          configuration.encryptionKey,
        )
        response.writeHead(302, {
          location: `${state.returnUrl}#google-drive-credential=${encodeURIComponent(credential)}`,
          'cache-control': 'no-store',
        })
        return response.end()
      }

      const origin = incoming.headers.origin
      if (origin && configuration.allowedOrigins.has(origin)) setCors(response, origin)
      if (incoming.method === 'OPTIONS') {
        response.writeHead(origin && configuration.allowedOrigins.has(origin) ? 204 : 403)
        return response.end()
      }
      if (!origin || !configuration.allowedOrigins.has(origin))
        return sendJson(response, 403, { error: 'Origin is not allowed' })

      if (incoming.method === 'POST' && url.pathname === '/token') {
        const credential = readCredential((await readJson(incoming)).credential, configuration)
        const tokens = await refreshAccessToken(credential.refreshToken, configuration, request)
        return sendJson(response, 200, {
          accessToken: tokens.access_token,
          expiresIn: tokens.expires_in,
        })
      }

      if (incoming.method === 'POST' && url.pathname === '/revoke') {
        const credential = readCredential((await readJson(incoming)).credential, configuration)
        const revokeResponse = await request(googleRevokeUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: credential.refreshToken }),
        })
        if (!revokeResponse.ok) throw new Error('Google rejected credential revocation')
        return sendJson(response, 200, { revoked: true })
      }

      return sendJson(response, 404, { error: 'Not found' })
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      return sendJson(response, 400, { error: 'The Google connection could not be completed' })
    }
  })
}

function readState(value, configuration) {
  const state = unseal(value ?? '', configuration.encryptionKey)
  if (
    state.kind !== 'oauth-state' ||
    state.expiresAt < Date.now() ||
    !configuration.returnUrls.has(state.returnUrl)
  ) {
    throw new Error('Invalid OAuth state')
  }
  return state
}

function readCredential(value, configuration) {
  const credential = unseal(typeof value === 'string' ? value : '', configuration.encryptionKey)
  if (
    credential.kind !== 'google-drive-credential' ||
    typeof credential.refreshToken !== 'string'
  ) {
    throw new Error('Invalid Google credential')
  }
  return credential
}

async function exchangeCode(code, configuration, request) {
  if (!code) throw new Error('Google authorization code is missing')
  return googleTokenRequest(
    {
      code,
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      redirect_uri: `${configuration.publicUrl}/oauth/callback`,
      grant_type: 'authorization_code',
    },
    request,
  )
}

async function refreshAccessToken(refreshToken, configuration, request) {
  return googleTokenRequest(
    {
      refresh_token: refreshToken,
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      grant_type: 'refresh_token',
    },
    request,
  )
}

async function googleTokenRequest(parameters, request) {
  const tokenResponse = await request(googleTokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parameters),
  })
  if (!tokenResponse.ok) throw new Error('Google rejected the token request')
  return tokenResponse.json()
}

async function readJson(request) {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > 64 * 1024) throw new Error('Request is too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function setCors(response, origin) {
  response.setHeader('access-control-allow-origin', origin)
  response.setHeader('access-control-allow-methods', 'POST, OPTIONS')
  response.setHeader('access-control-allow-headers', 'content-type')
  response.setHeader('vary', 'Origin')
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

function redirectWithError(response, returnUrl, message) {
  response.writeHead(302, {
    location: `${returnUrl}#google-drive-error=${encodeURIComponent(message)}`,
    'cache-control': 'no-store',
  })
  response.end()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8080)
  createCredentialServer(loadConfiguration()).listen(port, '0.0.0.0', () => {
    console.log(`Credential service listening on port ${port}`)
  })
}
