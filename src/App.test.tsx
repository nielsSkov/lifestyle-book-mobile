import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./components/WeightPlot', () => ({
  WeightPlot: () => <div>Plotly weight graph rendered</div>,
}))

import App from './App'

describe('App', () => {
  it('loads the complete focused prototype', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Weight' })).toBeInTheDocument()
    expect(await screen.findByText('Plotly weight graph rendered')).toBeInTheDocument()
    expect(screen.getByText('77.2')).toBeInTheDocument()
  })
})
