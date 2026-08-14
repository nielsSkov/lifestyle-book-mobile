import { lazy, Suspense, useEffect, useState } from 'react'

import './App.css'
import { InstallButton } from './components/InstallButton'
import { loadWeightPoints } from './data/weightRepository'
import type { WeightPoint } from './domain/weight'
import { weightChange } from './domain/weight'

const WeightChart = lazy(() =>
  import('./components/WeightChart').then((module) => ({ default: module.WeightChart })),
)

export default function App() {
  const [points, setPoints] = useState<WeightPoint[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [offlineReady, setOfflineReady] = useState(
    () => document.documentElement.dataset.offlineReady === 'true',
  )

  useEffect(() => {
    let active = true
    setLoadError(false)
    void loadWeightPoints()
      .then((storedPoints) => {
        if (active) setPoints(storedPoints)
      })
      .catch(() => {
        if (active) setLoadError(true)
      })
    return () => {
      active = false
    }
  }, [loadAttempt])

  useEffect(() => {
    const markReady = () => setOfflineReady(true)
    window.addEventListener('lifestyle-book:offline-ready', markReady)
    return () => window.removeEventListener('lifestyle-book:offline-ready', markReady)
  }, [])

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Lifestyle Book home">
          <span className="brand-mark" aria-hidden="true" />
          <span>Lifestyle Book</span>
        </a>
        <InstallButton />
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Your weight</p>
        <h1 id="page-title">A quieter view of progress.</h1>
        <p className="lede">Four months of measurements, without the daily noise.</p>
      </section>

      <section className="chart-card" aria-labelledby="chart-title">
        <div className="card-heading">
          <div>
            <p className="card-kicker">Trend</p>
            <h2 id="chart-title">Weight history</h2>
          </div>
          {points && points.length > 1 ? (
            <output className="change-pill" aria-label="Total change">
              {weightChange(points).toFixed(1)} kg
            </output>
          ) : null}
        </div>

        {loadError ? (
          <div className="chart-state" role="alert">
            <strong>Local storage is unavailable</strong>
            <span>Allow website storage, then try again.</span>
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
              Try again
            </button>
          </div>
        ) : points === null ? (
          <div className="chart-state" role="status">
            Loading measurements...
          </div>
        ) : points.length === 0 ? (
          <div className="chart-state">
            <strong>No measurements yet</strong>
            <span>Your weight history will appear here.</span>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="chart-state" role="status">
                Drawing chart...
              </div>
            }
          >
            <WeightChart points={points} />
          </Suspense>
        )}
      </section>

      <footer>
        <span className="offline-dot" aria-hidden="true" />
        {offlineReady ? 'Stored on this device and available offline' : 'Stored on this device'}
      </footer>
    </main>
  )
}
