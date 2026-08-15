const credentialStorageKey = 'lifestyle-book.google-drive-credential'
const driveApiUrl = 'https://www.googleapis.com/drive/v3'
const driveUploadUrl = 'https://www.googleapis.com/upload/drive/v3'
const folderName = 'Lifestyle Book'
const weightFileName = 'weight.csv'

type Fetch = typeof fetch
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

export class GoogleDriveClient {
  private readonly serviceUrl: string
  private readonly returnUrl: string
  private readonly storage: Storage
  private readonly request: Fetch
  private access: { token: string; expiresAt: number } | null = null
  private folderId: string | null = null
  private fileId: string | null | undefined

  constructor(
    serviceUrl: string,
    returnUrl: string,
    storage: Storage = localStorage,
    request: Fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.serviceUrl = serviceUrl
    this.returnUrl = returnUrl
    this.storage = storage
    this.request = request
  }

  get configured(): boolean {
    return this.serviceUrl.length > 0
  }

  get connected(): boolean {
    return this.storage.getItem(credentialStorageKey) !== null
  }

  get connectionUrl(): string {
    const url = new URL('/oauth/start', this.serviceUrl)
    url.searchParams.set('return_url', this.returnUrl)
    return url.href
  }

  acceptRedirect(hash: string): { connected: boolean; error: string } {
    const parameters = new URLSearchParams(hash.replace(/^#/, ''))
    const credential = parameters.get('google-drive-credential')
    const error = parameters.get('google-drive-error') ?? ''
    if (credential) this.storage.setItem(credentialStorageKey, credential)
    return { connected: credential !== null, error }
  }

  forget(): void {
    this.storage.removeItem(credentialStorageKey)
  }

  async readWeightCsv(): Promise<string> {
    const accessToken = await this.accessToken()
    const folderId = await this.findOrCreateFolder(accessToken)
    const fileId = await this.findFile(accessToken, folderId)
    if (!fileId) return 'date,weight_kg\n'

    const response = await this.driveRequest(
      `${driveApiUrl}/files/${encodeURIComponent(fileId)}?alt=media`,
      accessToken,
    )
    return response.text()
  }

  async writeWeightCsv(content: string): Promise<void> {
    const accessToken = await this.accessToken()
    const folderId = await this.findOrCreateFolder(accessToken)
    const existingFileId = await this.findFile(accessToken, folderId)
    const fileId = existingFileId ?? (await this.createFile(accessToken, folderId))
    await this.driveRequest(
      `${driveUploadUrl}/files/${encodeURIComponent(fileId)}?uploadType=media`,
      accessToken,
      { method: 'PATCH', headers: { 'content-type': 'text/csv' }, body: content },
    )
  }

  async revoke(): Promise<void> {
    const credential = this.credential()
    const response = await this.request(new URL('/revoke', this.serviceUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    if (!response.ok) throw new Error('Google access could not be revoked')
    this.forget()
  }

  private async accessToken(): Promise<string> {
    if (this.access && this.access.expiresAt > Date.now() + 60_000) return this.access.token

    const response = await this.request(new URL('/token', this.serviceUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: this.credential() }),
    })
    if (!response.ok) throw new Error('Google Drive must be reconnected')
    const result = (await response.json()) as { accessToken?: string; expiresIn?: number }
    if (!result.accessToken) throw new Error('The credential service returned no access token')
    this.access = {
      token: result.accessToken,
      expiresAt: Date.now() + (result.expiresIn ?? 3600) * 1000,
    }
    return result.accessToken
  }

  private credential(): string {
    const credential = this.storage.getItem(credentialStorageKey)
    if (!credential) throw new Error('Google Drive is not connected')
    return credential
  }

  private async findOrCreateFolder(accessToken: string): Promise<string> {
    if (this.folderId) return this.folderId

    const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    const existing = await this.listFiles(accessToken, query)
    if (existing[0]) {
      this.folderId = existing[0].id
      return this.folderId
    }

    const response = await this.driveRequest(`${driveApiUrl}/files?fields=id`, accessToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }),
    })
    this.folderId = ((await response.json()) as { id: string }).id
    return this.folderId
  }

  private async findFile(accessToken: string, folderId: string): Promise<string | null> {
    if (this.fileId !== undefined) return this.fileId

    const files = await this.listFiles(
      accessToken,
      `name = '${weightFileName}' and '${folderId}' in parents and trashed = false`,
    )
    this.fileId = files[0]?.id ?? null
    return this.fileId
  }

  private async createFile(accessToken: string, folderId: string): Promise<string> {
    const response = await this.driveRequest(`${driveApiUrl}/files?fields=id`, accessToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: weightFileName, parents: [folderId], mimeType: 'text/csv' }),
    })
    this.fileId = ((await response.json()) as { id: string }).id
    return this.fileId
  }

  private async listFiles(accessToken: string, query: string): Promise<Array<{ id: string }>> {
    const url = new URL(`${driveApiUrl}/files`)
    url.searchParams.set('q', query)
    url.searchParams.set('spaces', 'drive')
    url.searchParams.set('fields', 'files(id)')
    const response = await this.driveRequest(url, accessToken)
    return ((await response.json()) as { files: Array<{ id: string }> }).files
  }

  private async driveRequest(
    url: string | URL,
    accessToken: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${accessToken}`)
    const response = await this.request(url, { ...init, headers })
    if (!response.ok) throw new Error('Google Drive rejected the request')
    return response
  }
}
