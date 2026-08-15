import { lazy, Suspense, useEffect, useState } from 'react'
import type { MouseEvent } from 'react'

import './App.css'
import { GoogleDriveSettings } from './components/GoogleDriveSettings'
import { InstallButton } from './components/InstallButton'
import { loadWeightPoints } from './data/weightRepository'
import { recordSubtitle } from './domain/lifestyleSettings'
import type { WeightPoint } from './domain/weight'
import { formatMeasurementDate } from './domain/weight'

const WeightPlot = lazy(() =>
  import('./components/WeightPlot').then((module) => ({ default: module.WeightPlot })),
)

type Section = 'weight' | 'sleep' | 'daily' | 'options'

export default function App() {
  const [section, setSection] = useState<Section>(sectionFromLocation)
  const [points, setPoints] = useState<WeightPoint[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    const updateSection = () => setSection(sectionFromLocation())
    window.addEventListener('popstate', updateSection)
    return () => window.removeEventListener('popstate', updateSection)
  }, [])

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

  function navigate(event: MouseEvent<HTMLAnchorElement>, destination: Section) {
    event.preventDefault()
    window.history.pushState(null, '', sectionHref(destination))
    setSection(destination)
  }

  return (
    <>
      <header className="site-header">
        <a
          className="site-title"
          href={sectionHref('weight')}
          onClick={(event) => navigate(event, 'weight')}
        >
          <span>Lifestyle Book</span>
          <small>{recordSubtitle()}</small>
        </a>
        <a
          className={`options-link${section === 'options' ? ' active' : ''}`}
          href={sectionHref('options')}
          aria-label="Options"
          aria-current={section === 'options' ? 'page' : undefined}
          onClick={(event) => navigate(event, 'options')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
          </svg>
        </a>
      </header>

      <div className="navigation-bar">
        <nav className="section-tabs" aria-label="Lifestyle sections">
          {(['weight', 'sleep', 'daily'] as const).map((item) => (
            <a
              key={item}
              className={`section-tab${section === item ? ' active' : ''}`}
              href={sectionHref(item)}
              aria-current={section === item ? 'page' : undefined}
              onClick={(event) => navigate(event, item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </a>
          ))}
        </nav>
      </div>

      <main>
        {section === 'weight' ? (
          <WeightPage
            points={points}
            loadError={loadError}
            retry={() => setLoadAttempt((attempt) => attempt + 1)}
          />
        ) : null}
        {section === 'sleep' ? <PlaceholderPage eyebrow="Nightly record" heading="Sleep" /> : null}
        {section === 'daily' ? <PlaceholderPage eyebrow="Daily" heading="Achievements" /> : null}
        <OptionsPage hidden={section !== 'options'} />
      </main>
    </>
  )
}

function WeightPage({
  points,
  loadError,
  retry,
}: {
  points: WeightPoint[] | null
  loadError: boolean
  retry: () => void
}) {
  const latest = points?.at(-1)
  return (
    <>
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
            <button type="button" onClick={retry}>
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
    </>
  )
}

function PlaceholderPage({ eyebrow, heading }: { eyebrow: string; heading: string }) {
  return (
    <section className="entry-card placeholder-card">
      <div className="heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
        </div>
      </div>
    </section>
  )
}

function OptionsPage({ hidden }: { hidden: boolean }) {
  return (
    <section className="entry-card options-card" hidden={hidden}>
      <div className="heading">
        <div>
          <p className="eyebrow">Lifestyle Book</p>
          <h1>Options</h1>
        </div>
      </div>
      <GoogleDriveSettings />
      <InstallButton />
    </section>
  )
}

function sectionFromLocation(): Section {
  if (window.location.hash.startsWith('#google-drive-')) return 'options'
  const section = new URLSearchParams(window.location.search).get('section')
  return section === 'sleep' || section === 'daily' || section === 'options' ? section : 'weight'
}

function sectionHref(section: Section): string {
  const base = import.meta.env.BASE_URL
  return section === 'weight' ? base : `${base}?section=${section}`
}
