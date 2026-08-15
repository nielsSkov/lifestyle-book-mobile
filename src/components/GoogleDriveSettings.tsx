import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { GoogleDriveClient } from '../sync/googleDrive'

const serviceUrl = import.meta.env.VITE_GOOGLE_SYNC_SERVICE_URL ?? ''
const lastSyncStorageKey = 'lifestyle-book.google-drive-last-sync'

export function GoogleDriveSettings() {
  const [client] = useState(
    () =>
      new GoogleDriveClient(
        serviceUrl,
        new URL(import.meta.env.BASE_URL, window.location.origin).href,
      ),
  )
  const [connected, setConnected] = useState(client.connected)
  const [lastSync, setLastSync] = useState(() => localStorage.getItem(lastSyncStorageKey) ?? '')
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState(false)
  const syncInProgress = useRef(false)

  useEffect(() => {
    if (!window.location.hash.startsWith('#google-drive-')) return
    const result = client.acceptRedirect(window.location.hash)
    window.history.replaceState(null, '', `${window.location.pathname}?section=options`)
    setConnected(client.connected)
    setStatus(result.error || (result.connected ? 'Google Drive connected.' : ''))
  }, [client])

  async function synchronizeNow() {
    if (syncInProgress.current || !client.connected) return
    syncInProgress.current = true
    setWorking(true)
    setStatus('Synchronizing...')
    try {
      await client.readWeightCsv()
      const timestamp = new Date().toISOString()
      localStorage.setItem(lastSyncStorageKey, timestamp)
      setLastSync(timestamp)
      setStatus('Up to date.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Synchronization failed')
    } finally {
      syncInProgress.current = false
      setWorking(false)
    }
  }

  const automaticSynchronize = useEffectEvent(synchronizeNow)

  useEffect(() => {
    if (!connected) return
    const run = () => void automaticSynchronize()
    const runWhenVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    run()
    const interval = window.setInterval(run, 30_000)
    window.addEventListener('focus', run)
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', runWhenVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', run)
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', runWhenVisible)
    }
  }, [connected])

  if (!client.configured) return null

  return (
    <section className="option-section" aria-labelledby="google-drive-heading">
      <h2 id="google-drive-heading">Google Drive</h2>
      <p className="option-help">
        Keeps Lifestyle Book data synchronized across your devices. Local data remains available
        offline.
      </p>
      {!connected ? (
        <button type="button" onClick={() => window.location.assign(client.connectionUrl)}>
          Connect Google Drive
        </button>
      ) : (
        <>
          <p className="sync-state">
            <strong>Connected</strong>
            {lastSync ? <span>Last synchronized {new Date(lastSync).toLocaleString()}</span> : null}
          </p>
          <div className="option-actions">
            <button type="button" disabled={working} onClick={() => void synchronizeNow()}>
              Sync now
            </button>
            <button
              className="text-button"
              type="button"
              disabled={working}
              onClick={() => {
                client.forget()
                setConnected(false)
                setStatus('Google Drive disconnected on this device.')
              }}
            >
              Disconnect this device
            </button>
          </div>
        </>
      )}
      <p className="options-status" role="status">
        {status}
      </p>
    </section>
  )
}
