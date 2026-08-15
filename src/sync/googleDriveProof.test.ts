import { describe, expect, it, vi } from 'vitest'

import { GoogleDriveProofClient, updateProofWeightCsv } from './googleDriveProof'

describe('Google Drive proof client', () => {
  it('accepts a sealed credential without exposing it in the page URL', () => {
    const storage = memoryStorage()
    const client = new GoogleDriveProofClient(
      'https://broker.example',
      'https://app.example/',
      storage,
    )

    expect(client.acceptRedirect('#google-drive-credential=sealed-proof')).toEqual({
      connected: true,
      error: '',
    })
    expect(client.connected).toBe(true)
    expect(client.connectionUrl).toBe(
      'https://broker.example/oauth/start?return_url=https%3A%2F%2Fapp.example%2F',
    )
  })

  it('renews access through the broker but sends CSV content only to Drive', async () => {
    const storage = memoryStorage({ 'lifestyle-book.google-drive-credential': 'sealed-proof' })
    const requests: Array<{ url: string; body: BodyInit | null | undefined }> = []
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString()
      requests.push({ url, body: init?.body })
      if (url === 'https://broker.example/token') {
        return Response.json({ accessToken: 'short-lived-access', expiresIn: 3600 })
      }
      if (url.includes('/drive/v3/files?') && url.includes('mimeType')) {
        return Response.json({ files: [{ id: 'folder-id' }] })
      }
      if (url.includes('/drive/v3/files?') && url.includes('weight.csv')) {
        return Response.json({ files: [{ id: 'file-id' }] })
      }
      return new Response(null, { status: 200 })
    })
    const client = new GoogleDriveProofClient(
      'https://broker.example',
      'https://app.example/',
      storage,
      request as typeof fetch,
    )

    await client.readWeightCsv()
    await client.writeWeightCsv('date,weight_kg\n2026-08-15,77.0\n')

    expect(requests[0]).toEqual({
      url: 'https://broker.example/token',
      body: JSON.stringify({ credential: 'sealed-proof' }),
    })
    expect(requests.at(-1)?.url).toContain('https://www.googleapis.com/upload/drive/v3')
    expect(requests.at(-1)?.body).toBe('date,weight_kg\n2026-08-15,77.0\n')
    expect(requests.filter(({ url }) => url.startsWith('https://broker.example'))).toHaveLength(1)
  })
})

describe('proof Weight CSV', () => {
  it('adds and replaces dated rows in chronological order', () => {
    const csv = 'date,weight_kg\n2026-08-15,77.0\n2026-08-13,78.0\n'

    expect(updateProofWeightCsv(csv, '2026-08-14', 77.5)).toBe(
      'date,weight_kg\n2026-08-13,78.0\n2026-08-14,77.5\n2026-08-15,77.0\n',
    )
    expect(updateProofWeightCsv(csv, '2026-08-15', 76.9)).toContain('2026-08-15,76.9')
  })
})

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}
