import { useEffect, useRef, useState } from 'react'
import type { Config, Data, Layout, PlotlyHTMLElement, PlotMouseEvent } from 'plotly.js'

import { samplePlanPoints } from '../data/samplePlanPoints'
import type { WeightPoint } from '../domain/weight'
import { formatMeasurementDate } from '../domain/weight'

type WeightPlotProps = Readonly<{ points: readonly WeightPoint[] }>

type ReadoutValue = Readonly<{
  color: string
  label: string
  value: string
}>

type Readout = Readonly<{
  date: string
  values: ReadoutValue[]
}>

function traceColor(trace: Data): string {
  const line = (trace as { line?: { color?: unknown } }).line
  if (typeof line?.color === 'string') return line.color
  const marker = (trace as { marker?: { color?: unknown } }).marker
  if (typeof marker?.color === 'string') return marker.color
  return '#a99db9'
}

export function WeightPlot({ points }: WeightPlotProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [readout, setReadout] = useState<Readout | null>(null)
  const [plotStatus, setPlotStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const target = plotRef.current
    if (!target) return
    let active = true
    let plot: PlotlyHTMLElement | null = null
    let runtime: typeof import('plotly.js') | null = null

    setPlotStatus('loading')
    void import('plotly.js-basic-dist-min')
      .then(async ({ default: Plotly }) => {
        if (!active) return
        runtime = Plotly
        const plan = samplePlanPoints
        const latest = points.at(-1)!
        const data: Data[] = [
          {
            type: 'scatter',
            mode: 'lines',
            name: 'Plan',
            x: plan.map(({ date }) => date),
            y: plan.map(({ kilograms }) => kilograms),
            connectgaps: false,
            line: { color: '#087044', width: 2.8 },
            hoverinfo: 'none',
          },
          {
            type: 'scatter',
            mode: 'lines',
            name: 'Recorded weight',
            x: points.map(({ date }) => date),
            y: points.map(({ kilograms }) => kilograms),
            connectgaps: false,
            line: { color: '#8b5cf6', width: 1.8 },
            hoverinfo: 'none',
          },
          {
            type: 'scatter',
            mode: 'markers',
            name: 'Latest',
            x: [latest.date],
            y: [latest.kilograms],
            marker: { color: '#8b5cf6', size: 9 },
            showlegend: false,
            hoverinfo: 'skip',
          },
        ]
        const paddedStart = new Date(`${points[0]!.date}T12:00:00Z`)
        const paddedEnd = new Date(`${plan.at(-1)!.date}T12:00:00Z`)
        paddedStart.setUTCDate(paddedStart.getUTCDate() - 3)
        paddedEnd.setUTCDate(paddedEnd.getUTCDate() + 3)

        const layout: Partial<Layout> = {
          autosize: true,
          title: { text: 'Recorded Weight and Plan', x: 0.5 },
          paper_bgcolor: '#15111f',
          plot_bgcolor: '#15111f',
          font: {
            color: '#bbb3c9',
            family: 'Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif',
          },
          hovermode: 'x unified',
          uirevision: 'weight',
          margin: { l: 64, r: 24, t: 70, b: 48 },
          legend: { orientation: 'h', x: 0, y: 1.02, xanchor: 'left', yanchor: 'bottom' },
          xaxis: {
            title: { text: 'Date' },
            gridcolor: '#383047',
            linecolor: '#524762',
            fixedrange: false,
            range: [paddedStart.toISOString(), paddedEnd.toISOString()],
          },
          yaxis: {
            title: { text: 'Weight (kg)' },
            gridcolor: '#383047',
            linecolor: '#524762',
            fixedrange: false,
            zeroline: false,
          },
          annotations: [
            {
              x: latest.date,
              y: latest.kilograms,
              text: `${latest.kilograms.toFixed(1)} kg`,
              showarrow: false,
              xanchor: 'left',
              yanchor: 'bottom',
              xshift: 8,
              yshift: 8,
              font: { color: '#a78bfa', size: 13 },
            },
          ],
        }
        const config: Partial<Config> = {
          displaylogo: false,
          displayModeBar: true,
          modeBarButtons: [['zoom2d', 'pan2d', 'resetScale2d']],
          responsive: true,
          scrollZoom: false,
          showTips: false,
        }

        const rendered = await Plotly.newPlot(target, data, layout, config)
        if (!active) {
          Plotly.purge(rendered)
          return
        }
        plot = rendered
        setPlotStatus('ready')
        const show = (event: PlotMouseEvent) => {
          const inspected = String(event.points[0]?.x ?? '')
          const values = event.points
            .filter((point) => String(point.x) === inspected && Number.isFinite(Number(point.y)))
            .map((point) => ({
              color: traceColor(point.data),
              label: point.data.name ?? 'Weight',
              value: `${Number(point.y).toFixed(1)} kg`,
            }))
          if (values.length > 0) {
            setReadout({ date: formatMeasurementDate(inspected), values })
          }
        }
        plot.on('plotly_hover', show)
        plot.on('plotly_click', show)
      })
      .catch(() => {
        if (active) setPlotStatus('error')
      })

    return () => {
      active = false
      if (runtime && plot) runtime.purge(plot)
    }
  }, [points])

  return (
    <div className="weight-graph">
      <div
        ref={plotRef}
        className="weight-plot"
        data-testid="weight-plot"
        role="region"
        aria-label="Interactive recorded and planned weight chart"
      />
      {plotStatus !== 'ready' ? (
        <div className="plot-load-state" role={plotStatus === 'error' ? 'alert' : 'status'}>
          {plotStatus === 'error' ? 'The interactive graph could not load.' : 'Loading Plotly...'}
        </div>
      ) : null}
      {readout ? (
        <div className="plot-readout" aria-live="polite">
          <strong className="plot-readout-date">{readout.date}</strong>
          <span className="plot-readout-values">
            {readout.values.map((item) => (
              <span className="plot-readout-value" key={item.label}>
                <i style={{ '--readout-color': item.color } as React.CSSProperties} />
                <span>{item.label}: </span>
                <strong>{item.value}</strong>
              </span>
            ))}
          </span>
        </div>
      ) : null}
      <table className="visually-hidden">
        <caption>Recorded weight measurements</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Weight</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{formatMeasurementDate(point.date)}</td>
              <td>{point.kilograms.toFixed(1)} kg</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
