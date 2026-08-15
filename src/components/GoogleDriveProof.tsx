import { useEffect, useState } from 'react'

import { GoogleDriveProofClient, updateProofWeightCsv } from '../sync/googleDriveProof'

const serviceUrl = import.meta.env.VITE_GOOGLE_SYNC_SERVICE_URL ?? ''

export function GoogleDriveProof() {
  const [client] = useState(
    () =>
      new GoogleDriveProofClient(
        serviceUrl,
        new URL(import.meta.env.BASE_URL, window.location.origin).href,
      ),
  )
  const [connected, setConnected] = useState(client.connected)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [kilograms, setKilograms] = useState('77.0')
  const [csv, setCsv] = useState('')
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!window.location.hash.startsWith('#google-drive-')) return
    const result = client.acceptRedirect(window.location.hash)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setConnected(client.connected)
    setStatus(result.error || (result.connected ? 'Google Drive connected.' : ''))
  }, [client])

  if (!client.configured) return null

  async function run(action: () => Promise<void>) {
    setWorking(true)
    setStatus('Synchronizing...')
    try {
      await action()
      setStatus('Synchronization complete.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Synchronization failed')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="sync-proof-card" aria-labelledby="sync-proof-heading">
      <p className="eyebrow">Synchronization proof</p>
      <h2 id="sync-proof-heading">Google Drive</h2>
      <p className="sync-proof-copy">
        Temporary test of one-time authorization, silent renewal, and a shared Weight CSV.
      </p>

      {!connected ? (
        <button type="button" onClick={() => window.location.assign(client.connectionUrl)}>
          Connect Google Drive
        </button>
      ) : (
        <>
          <div className="sync-proof-form">
            <label htmlFor="proof-date">Test date</label>
            <input
              id="proof-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <label htmlFor="proof-weight">Test weight</label>
            <div className="input-row">
              <input
                id="proof-weight"
                inputMode="decimal"
                value={kilograms}
                onChange={(event) => setKilograms(event.target.value)}
              />
              <span>kg</span>
            </div>
          </div>
          <div className="sync-proof-actions">
            <button
              type="button"
              disabled={working}
              onClick={() =>
                void run(async () => {
                  setCsv(await client.readWeightCsv())
                })
              }
            >
              Read shared CSV
            </button>
            <button
              type="button"
              disabled={working || !date || !Number.isFinite(Number(kilograms))}
              onClick={() =>
                void run(async () => {
                  const updated = updateProofWeightCsv(
                    await client.readWeightCsv(),
                    date,
                    Number(kilograms),
                  )
                  await client.writeWeightCsv(updated)
                  setCsv(updated)
                })
              }
            >
              Write test row
            </button>
          </div>
          <button
            className="text-button"
            type="button"
            disabled={working}
            onClick={() => {
              client.forget()
              setConnected(false)
              setCsv('')
              setStatus('Connection forgotten on this device.')
            }}
          >
            Forget on this device
          </button>
        </>
      )}

      {status ? (
        <p className="sync-proof-status" role="status">
          {status}
        </p>
      ) : null}
      {csv ? <pre className="sync-proof-output">{csv}</pre> : null}
    </section>
  )
}
