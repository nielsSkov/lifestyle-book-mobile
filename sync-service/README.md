# Google Credential Proof Service

This service performs the confidential OAuth code exchange and renews short-lived Google access tokens. Lifestyle Book data goes directly between a device and Google Drive; the service never receives CSV content.

## Configuration

- `GOOGLE_CLIENT_ID`: Google OAuth web client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth web client secret.
- `PUBLIC_URL`: HTTPS origin of the deployed service.
- `ALLOWED_RETURN_URLS`: Comma-separated exact PWA return URLs.
- `CREDENTIAL_ENCRYPTION_KEY`: 32 random bytes encoded as base64.

The Google OAuth client's authorized redirect URI must be `${PUBLIC_URL}/oauth/callback`.

The proof uses a sealed credential held by each device, making the service stateless. Production work must add encryption-key rotation and explicit per-device revocation before public release.
