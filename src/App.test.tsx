import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./components/WeightChart', () => ({
  WeightChart: () => <div>Weight chart rendered</div>,
}))

import App from './App'

describe('App', () => {
  it('loads the complete focused prototype', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'A quieter view of progress.' })).toBeInTheDocument()
    expect(await screen.findByText('Weight chart rendered')).toBeInTheDocument()
    expect(screen.getByText('-5.2 kg')).toBeInTheDocument()
    expect(screen.getByText('Stored on this device')).toBeInTheDocument()
  })
})
