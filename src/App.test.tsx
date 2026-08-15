import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./components/WeightPlot', () => ({
  WeightPlot: () => <div>Plotly weight graph rendered</div>,
}))

import App from './App'

describe('App', () => {
  it('loads the complete focused prototype', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Weight' })).toBeInTheDocument()
    expect(screen.getByText('Everyday log')).toBeInTheDocument()
    expect(screen.getByText('Daily record')).toBeInTheDocument()
    expect(await screen.findByText('Plotly weight graph rendered')).toBeInTheDocument()
    expect(screen.getByText('77.2')).toBeInTheDocument()
  })

  it('uses the existing navigation and keeps Google Drive in Options', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('navigation', { name: 'Lifestyle sections' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Options' }))

    expect(screen.getByRole('heading', { name: 'Options' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Google Drive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect Google Drive' })).toBeInTheDocument()
    expect(screen.queryByText('Synchronization proof')).not.toBeInTheDocument()
  })
})
