import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { WeightChart } from './WeightChart'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  AreaChart: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  Area: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

const points = [
  { date: '2026-08-01', kilograms: 78 },
  { date: '2026-08-13', kilograms: 77.2 },
]

describe('WeightChart', () => {
  it('shows the latest point and supports keyboard-friendly navigation', () => {
    render(<WeightChart points={points} />)

    expect(screen.getByLabelText('77.2 kilograms')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /previous/i }))
    expect(screen.getByLabelText('78.0 kilograms')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
  })

  it('updates the persistent readout during a touch drag', () => {
    render(<WeightChart points={points} />)
    const chart = screen.getByTestId('weight-chart')
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 300,
      bottom: 200,
      width: 300,
      height: 200,
      toJSON: () => ({}),
    })

    fireEvent.pointerMove(chart, { pointerType: 'touch', clientX: 0 })
    expect(screen.getByLabelText('78.0 kilograms')).toBeInTheDocument()
  })
})
