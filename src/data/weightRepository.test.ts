import { deleteDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'

import { loadWeightPoints } from './weightRepository'

afterEach(() => deleteDB('lifestyle-book'))

describe('weight repository', () => {
  it('seeds stable representative data on first launch', async () => {
    const firstLoad = await loadWeightPoints()
    const secondLoad = await loadWeightPoints()

    expect(firstLoad).toHaveLength(23)
    expect(firstLoad[0]?.date).toBe('2026-04-18')
    expect(secondLoad).toEqual(firstLoad)
  })
})
