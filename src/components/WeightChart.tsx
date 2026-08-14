import { useState, type PointerEvent } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { WeightPoint } from '../domain/weight'
import { formatMeasurementDate, weightDomain } from '../domain/weight'

type WeightChartProps = Readonly<{ points: readonly WeightPoint[] }>

type TooltipContentProps = Readonly<{
  active?: boolean
  payload?: Array<{ payload: WeightPoint }>
}>

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload
  return (
    <div className="tooltip" role="presentation">
      <span>{formatMeasurementDate(point.date)}</span>
      <strong>{point.kilograms.toFixed(1)} kg</strong>
    </div>
  )
}

export function WeightChart({ points }: WeightChartProps) {
  const [selectedIndex, setSelectedIndex] = useState(points.length - 1)
  const selected = points[selectedIndex]!

  function moveSelection(direction: -1 | 1) {
    setSelectedIndex((current) => Math.min(points.length - 1, Math.max(0, current + direction)))
  }

  function selectFromPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    setSelectedIndex(Math.round(position * (points.length - 1)))
  }

  return (
    <div className="weight-chart">
      <div id="selected-measurement" className="measurement" aria-live="polite" aria-atomic="true">
        <div>
          <span className="measurement-label">Selected measurement</span>
          <strong>{formatMeasurementDate(selected.date)}</strong>
        </div>
        <output aria-label={`${selected.kilograms.toFixed(1)} kilograms`}>
          {selected.kilograms.toFixed(1)} <small>kg</small>
        </output>
      </div>

      <div
        className="chart-wrap"
        data-testid="weight-chart"
        onPointerDown={selectFromPointer}
        onPointerMove={selectFromPointer}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 12, right: 4, bottom: 0, left: 4 }}
            onMouseMove={(state) => {
              if (typeof state.activeTooltipIndex === 'number')
                setSelectedIndex(state.activeTooltipIndex)
            }}
            onClick={(state) => {
              if (typeof state.activeTooltipIndex === 'number')
                setSelectedIndex(state.activeTooltipIndex)
            }}
          >
            <defs>
              <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b7ef68" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#b7ef68" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#354038" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              minTickGap={34}
              tickFormatter={(date: string) => formatMeasurementDate(date, 'short')}
              tick={{ fill: '#9ba49c' }}
            />
            <YAxis
              orientation="right"
              axisLine={false}
              tickLine={false}
              width={34}
              domain={weightDomain(points)}
              tick={{ fill: '#9ba49c' }}
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: '#e8eee7', strokeOpacity: 0.45 }}
            />
            <Area
              type="linear"
              dataKey="kilograms"
              stroke="#b7ef68"
              strokeWidth={3}
              fill="url(#weight-fill)"
              activeDot={{ r: 5, fill: '#b7ef68', stroke: '#182019', strokeWidth: 3 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-controls" role="group" aria-label="Inspect measurements">
        <button type="button" onClick={() => moveSelection(-1)} disabled={selectedIndex === 0}>
          <span aria-hidden="true">←</span> Previous
        </button>
        <label className="chart-scrubber">
          <span>
            Measurement {selectedIndex + 1} of {points.length}
          </span>
          <input
            type="range"
            min="0"
            max={points.length - 1}
            value={selectedIndex}
            aria-describedby="selected-measurement"
            onChange={(event) => setSelectedIndex(event.currentTarget.valueAsNumber)}
          />
        </label>
        <button
          type="button"
          onClick={() => moveSelection(1)}
          disabled={selectedIndex === points.length - 1}
        >
          Next <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}
