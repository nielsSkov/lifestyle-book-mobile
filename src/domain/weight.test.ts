import { describe, expect, it } from 'vitest'

import { formatMeasurementDate, sortWeightPoints, weightChange, weightDomain } from './weight'

describe('weight domain', () => {
  it('filters invalid values and sorts by calendar date', () => {
    expect(
      sortWeightPoints([
        { date: '2026-02-02', kilograms: 79 },
        { date: 'invalid', kilograms: 80 },
        { date: '2026-01-01', kilograms: 80 },
        { date: '2026-03-03', kilograms: -1 },
      ]),
    ).toEqual([
      { date: '2026-01-01', kilograms: 80 },
      { date: '2026-02-02', kilograms: 79 },
    ])
  })

  it('calculates total change', () => {
    expect(
      weightChange([
        { date: '2026-01-01', kilograms: 80 },
        { date: '2026-02-02', kilograms: 78.5 },
      ]),
    ).toBe(-1.5)
    expect(weightChange([{ date: '2026-01-01', kilograms: 80 }])).toBe(0)
  })

  it('pads the chart domain to half-kilogram boundaries', () => {
    expect(
      weightDomain([
        { date: '2026-01-01', kilograms: 80 },
        { date: '2026-02-02', kilograms: 82 },
      ]),
    ).toEqual([79, 83])
  })

  it('formats calendar dates independently of local timezone', () => {
    expect(formatMeasurementDate('2026-08-13', 'short')).toMatch(/13/)
    expect(formatMeasurementDate('2026-08-13')).toMatch(/2026/)
  })
})
