import { describe, expect, it } from 'vitest'

import { DEFAULT_RECORD_SUBTITLE, recordSubtitle } from './lifestyleSettings'

describe('recordSubtitle', () => {
  it('uses the public default until a name is configured', () => {
    expect(recordSubtitle()).toBe(DEFAULT_RECORD_SUBTITLE)
    expect(DEFAULT_RECORD_SUBTITLE).toBe('Everyday log')
  })

  it.each([
    ['Niels', "Niels' log"],
    ['Alex', "Alex's log"],
  ])('builds the personal subtitle for %s', (name, expected) => {
    expect(recordSubtitle(name)).toBe(expected)
  })
})
