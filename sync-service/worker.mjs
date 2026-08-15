import { parseEncryptionKey, seal, unseal } from './credentials.mjs'

const googleAuthorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
const googleTokenUrl = 'https://oauth2.googleapis.com/token'
const googleRevokeUrl = 'https://oauth2.googleapis.com/revoke'
const stateLifetimeMs = 10 * 60 * 1000

export default {
  fetch(request, environment) {
    return handleRequest(request, environment)
  },
}

export async function handleRequest(incoming, environment, googleRequest = fetch) {
  try {
    const configuration = loadConfiguration(environment)
    const url = new URL(incoming.url)

    if (incoming.method === 'GET' && url.pathname === '/health') {
      return json(200, { status: 'ok' })
    }

    if (incoming.method === 'GET' && url.pathname === '/oauth/start') {
      const returnUrl = new URL(url.searchParams.get('return_url') ?? '').href
      if (!configuration.returnUrls.has(returnUrl)) {
        return json(400, { error: 'Invalid return URL' })
      }

      const state = await seal(
        { kind: 'oauth-state', returnUrl, expiresAt: Date.now() + stateLifetimeMs },
        configuration.encryptionKey,
      )
      const authorization = new URL(googleAuthorizationUrl)
      authorization.search = new URLSearchParams({
        client_id: configuration.clientId,
        redirect_uri: `${url.origin}/oauth/callback`,
        response_type: 'code',
        scope: 'openid email https://www.googleapis.com/auth/drive.file',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      }).toString()
      return redirect(authorization.href)
    }

    if (incoming.method === 'GET' && url.pathname === '/oauth/callback') {
      const state = await readState(url.searchParams.get('state'), configuration)
      if (url.searchParams.has('error')) {
        return redirect(
          `${state.returnUrl}#google-drive-error=${encodeURIComponent('Google access was not granted')}`,
        )
      }

      const tokens = await exchangeCode(
        url.searchParams.get('code'),
        url.origin,
        configuration,
        googleRequest,
      )
      if (!tokens.refresh_token) throw new Error('Google did not return a refresh token')
      const credential = await seal(
        { kind: 'google-drive-credential', refreshToken: tokens.refresh_token },
        configuration.encryptionKey,
      )
      return redirect(
        `${state.returnUrl}#google-drive-credential=${encodeURIComponent(credential)}`,
      )
    }

    const origin = incoming.headers.get('origin')
    const allowedOrigin = origin && configuration.allowedOrigins.has(origin) ? origin : null
    if (incoming.method === 'OPTIONS') {
      return allowedOrigin
        ? cors(new Response(null, { status: 204 }), allowedOrigin)
        : json(403, { error: 'Origin is not allowed' })
    }
    if (!allowedOrigin) return json(403, { error: 'Origin is not allowed' })

    if (incoming.method === 'POST' && url.pathname === '/token') {
      const credential = await readCredential((await incoming.json()).credential, configuration)
      const tokens = await refreshAccessToken(credential.refreshToken, configuration, googleRequest)
      return cors(
        json(200, { accessToken: tokens.access_token, expiresIn: tokens.expires_in }),
        allowedOrigin,
      )
    }

    if (incoming.method === 'POST' && url.pathname === '/revoke') {
      const credential = await readCredential((await incoming.json()).credential, configuration)
      const revokeResponse = await googleRequest(googleRevokeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: credential.refreshToken }),
      })
      if (!revokeResponse.ok) throw new Error('Google rejected credential revocation')
      return cors(json(200, { revoked: true }), allowedOrigin)
    }

    return json(404, { error: 'Not found' })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    return json(400, { error: 'The Google connection could not be completed' })
  }
}

function loadConfiguration(environment) {
  for (const name of [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'ALLOWED_RETURN_URLS',
    'CREDENTIAL_ENCRYPTION_KEY',
  ]) {
    if (!environment[name]) throw new Error(`${name} is required`)
  }
  const returnUrls = new Set(
    environment.ALLOWED_RETURN_URLS.split(',').map((value) => new URL(value.trim()).href),
  )
  return {
    clientId: environment.GOOGLE_CLIENT_ID,
    clientSecret: environment.GOOGLE_CLIENT_SECRET,
    returnUrls,
    allowedOrigins: new Set([...returnUrls].map((value) => new URL(value).origin)),
    encryptionKey: parseEncryptionKey(environment.CREDENTIAL_ENCRYPTION_KEY),
  }
}

async function readState(value, configuration) {
  const state = await unseal(value ?? '', configuration.encryptionKey)
  if (
    state.kind !== 'oauth-state' ||
    state.expiresAt < Date.now() ||
    !configuration.returnUrls.has(state.returnUrl)
  ) {
    throw new Error('Invalid OAuth state')
  }
  return state
}

async function readCredential(value, configuration) {
  const credential = await unseal(
    typeof value === 'string' ? value : '',
    configuration.encryptionKey,
  )
  if (
    credential.kind !== 'google-drive-credential' ||
    typeof credential.refreshToken !== 'string'
  ) {
    throw new Error('Invalid Google credential')
  }
  return credential
}

function exchangeCode(code, publicUrl, configuration, request) {
  if (!code) throw new Error('Google authorization code is missing')
  return googleTokenRequest(
    {
      code,
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      redirect_uri: `${publicUrl}/oauth/callback`,
      grant_type: 'authorization_code',
    },
    request,
  )
}

function refreshAccessToken(refreshToken, configuration, request) {
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
  const response = await request(googleTokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parameters),
  })
  if (!response.ok) throw new Error('Google rejected the token request')
  return response.json()
}

function json(status, body) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { location, 'cache-control': 'no-store' },
  })
}

function cors(response, origin) {
  response.headers.set('access-control-allow-origin', origin)
  response.headers.set('access-control-allow-methods', 'POST, OPTIONS')
  response.headers.set('access-control-allow-headers', 'content-type')
  response.headers.set('vary', 'Origin')
  return response
}
