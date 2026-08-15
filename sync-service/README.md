# Google Credential Proof Service

This Cloudflare Worker performs the confidential OAuth code exchange and renews short-lived Google access tokens. Lifestyle Book data goes directly between a device and Google Drive; the Worker never receives CSV content.

## Configuration

- `GOOGLE_CLIENT_ID`: Google OAuth web client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth web client secret.
- `ALLOWED_RETURN_URLS`: Comma-separated exact PWA return URLs.
- `CREDENTIAL_ENCRYPTION_KEY`: 32 random bytes encoded as base64.

The Google OAuth client's authorized redirect URI must be the Worker's public `https://...workers.dev/oauth/callback` URL.

The proof uses a sealed credential held by each device, making the service stateless. Production work must add encryption-key rotation and explicit per-device revocation before public release.

The Worker targets the Cloudflare Workers Free plan: no database, no paid bindings, and no Lifestyle Book data transfer.
