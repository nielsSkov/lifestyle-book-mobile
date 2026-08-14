import { lazy, Suspense, useEffect, useState } from 'react'

import './App.css'
import { InstallButton } from './components/InstallButton'
import { loadWeightPoints } from './data/weightRepository'
import type { WeightPoint } from './domain/weight'
import { formatMeasurementDate } from './domain/weight'

const WeightPlot = lazy(() =>
  import('./components/WeightPlot').then((module) => ({ default: module.WeightPlot })),
)

export default function App() {
  const [points, setPoints] = useState<WeightPoint[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const latest = points?.at(-1)

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

  return (
    <>
      <header className="site-header">
        <a className="site-title" href={import.meta.env.BASE_URL}>
          <span>Lifestyle Book</span>
          <small>Niels' log</small>
        </a>
        <InstallButton />
      </header>

      <main>
        <section className="page-heading">
          <div>
            <p className="eyebrow">Daily record</p>
            <h1>Weight</h1>
          </div>
          {latest ? (
            <p className="latest">
              <strong>{latest.kilograms.toFixed(1)}</strong> kg
              <br />
              <span>{formatMeasurementDate(latest.date)}</span>
            </p>
          ) : null}
        </section>

        <section className="graph-card">
          {loadError ? (
            <div className="graph-state" role="alert">
              <strong>Local storage is unavailable</strong>
              <span>Allow website storage, then try again.</span>
              <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                Try again
              </button>
            </div>
          ) : points === null ? (
            <div className="graph-state" role="status">
              Loading measurements...
            </div>
          ) : points.length === 0 ? (
            <div className="graph-state">No measurements yet.</div>
          ) : (
            <Suspense
              fallback={
                <div className="graph-state" role="status">
                  Loading Plotly...
                </div>
              }
            >
              <WeightPlot points={points} />
            </Suspense>
          )}
        </section>
      </main>
    </>
  )
}
