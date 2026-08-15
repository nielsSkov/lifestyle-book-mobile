import { describe, expect, it } from 'vitest'

import {
  formatMeasurementDate,
  parseMeasurementDate,
  parseWeight,
  parseWeightCsv,
  serializeWeightCsv,
  validateWeightPoints,
  weightChange,
  weightDomain,
} from './weight'

describe('weight entry parsing', () => {
  it.each([
    ['109.8', 109.8],
    ['109,8', 109.8],
    ['0', 0],
    ['700', 700],
  ])('parses %s', (raw, expected) => expect(parseWeight(raw)).toBe(expected))

  it.each([null, '', ' ', 'hello'])('rejects malformed weight %s', (raw) => {
    expect(() => parseWeight(raw)).toThrow('Enter a valid weight')
  })

  it.each(['NaN', 'Infinity', '-0.1', '701'])('rejects out-of-range weight %s', (raw) => {
    expect(() => parseWeight(raw)).toThrow('Weight must be between 0 and 700 kg')
  })

  it('accepts today and historical dates but rejects invalid or future dates', () => {
    expect(parseMeasurementDate('2026-07-25', '2026-08-03')).toBe('2026-07-25')
    expect(parseMeasurementDate('2026-08-03', '2026-08-03')).toBe('2026-08-03')
    for (const value of [null, '', 'not-a-date', '2026-02-30', '0000-01-01'])
      expect(() => parseMeasurementDate(value, '2026-08-03')).toThrow(
        'Choose a valid measurement date',
      )
    expect(() => parseMeasurementDate('2026-08-04', '2026-08-03')).toThrow(
      'Measurement date cannot be in the future',
    )
  })
})

describe('Weight CSV', () => {
  it('parses strict CSV with quoted fields, CRLF, and a UTF-8 BOM', () => {
    expect(parseWeightCsv('\uFEFF"date","weight_kg"\r\n"2026-07-25","109.8"\r\n')).toEqual([
      { date: '2026-07-25', kilograms: 109.8 },
    ])
    expect(
      parseWeightCsv(new TextEncoder().encode('date,weight_kg\n2026-07-25,109.8\n')),
    ).toHaveLength(1)
    expect(parseWeightCsv('date,weight_kg\n2026-07-25,109.8')).toHaveLength(1)
  })

  it('rejects an invalid encoding, header, empty import, and malformed CSV', () => {
    expect(() => parseWeightCsv(new Uint8Array([0xff]))).toThrow('CSV must use UTF-8 encoding')
    expect(() => parseWeightCsv('day,weight\n2026-07-25,109.8\n')).toThrow(
      'Expected header: date,weight_kg',
    )
    expect(() => parseWeightCsv('date,weight_kg\n')).toThrow('CSV contains no data rows')
    expect(parseWeightCsv('date,weight_kg\n', { allowEmpty: true })).toEqual([])
    expect(() => parseWeightCsv('"date,weight_kg\n')).toThrow('unexpected end of data')
    expect(() => parseWeightCsv('"date"x,weight_kg\n')).toThrow(
      'unexpected character after closing quote',
    )
    expect(() => parseWeightCsv('date,weight_kg\n"2026-07-2""5",100\n')).toThrow(
      "invalid date '2026-07-2\"5'",
    )
  })

  it('rejects malformed rows, dates, weights, bounds, duplicates, and ordering', () => {
    expect(() => parseWeightCsv('date,weight_kg\n2026-07-25\n')).toThrow(
      'Line 2: expected two columns',
    )
    expect(() => parseWeightCsv('date,weight_kg\n2026-02-30,100\n')).toThrow(
      "Line 2: invalid date '2026-02-30'",
    )
    for (const weight of [' 100', '.5', '1.', '1e2'])
      expect(() => parseWeightCsv(`date,weight_kg\n2026-07-25,${weight}\n`)).toThrow(
        'Line 2: invalid weight',
      )
    for (const weight of ['-0.1', '701'])
      expect(() => parseWeightCsv(`date,weight_kg\n2026-07-25,${weight}\n`)).toThrow(
        'Line 2: weight must be between 0 and 700 kg',
      )
    for (const rows of ['2026-07-25,100\n2026-07-25,99\n', '2026-07-26,100\n2026-07-25,99\n'])
      expect(() => parseWeightCsv(`date,weight_kg\n${rows}`)).toThrow(
        'dates must be unique and increasing',
      )
  })

  it('supports explicit plan gaps only when requested', () => {
    const csv = 'date,weight_kg\n2026-08-01,100\n2026-08-02,NaN\n2026-08-03,95\n'
    expect(parseWeightCsv(csv, { allowGaps: true })[1]?.kilograms).toBeNaN()
    expect(() => parseWeightCsv(csv)).toThrow('Line 3: weight must be between 0 and 700 kg')
    expect(
      serializeWeightCsv(
        [
          { date: '2026-08-01', kilograms: 100 },
          { date: '2026-08-02', kilograms: Number.NaN },
          { date: '2026-08-03', kilograms: 95 },
        ],
        { allowGaps: true },
      ),
    ).toBe(csv)
  })

  it('serializes canonical sorted records and an empty dataset', () => {
    expect(
      serializeWeightCsv([
        { date: '2026-07-25', kilograms: 109.8 },
        { date: '2026-07-27', kilograms: 0.0000001 },
      ]),
    ).toBe('date,weight_kg\n2026-07-25,109.8\n2026-07-27,0.0000001\n')
    expect(serializeWeightCsv([])).toBe('date,weight_kg\n')
    expect(() => serializeWeightCsv([{ date: 'invalid', kilograms: 100 }])).toThrow(
      "Line 2: invalid date 'invalid'",
    )
    expect(() =>
      serializeWeightCsv([
        { date: '2026-07-25', kilograms: 100 },
        { date: '2026-07-25', kilograms: 99 },
      ]),
    ).toThrow('dates must be unique and increasing')
    expect(() => serializeWeightCsv([{ date: '2026-07-25', kilograms: 701 }])).toThrow(
      'weight must be between 0 and 700 kg',
    )
  })
})

describe('validated Weight records', () => {
  it('accepts an empty or strictly ordered dataset including zero', () => {
    expect(validateWeightPoints([])).toEqual([])
    expect(
      validateWeightPoints([
        { date: '2026-07-25', kilograms: 0 },
        { date: '2026-07-27', kilograms: 109.6 },
      ]),
    ).toEqual([
      { date: '2026-07-25', kilograms: 0 },
      { date: '2026-07-27', kilograms: 109.6 },
    ])
  })

  it('rejects corrupt records and duplicate or unordered dates as a whole', () => {
    expect(() => validateWeightPoints(null)).toThrow('Weight data must be a list')
    for (const value of [
      null,
      { date: 'invalid', kilograms: 100 },
      { date: '2026-07-25', kilograms: Number.NaN },
      { date: '2026-07-25', kilograms: -1 },
      { date: '2026-07-25', kilograms: 701 },
      { date: '2026-07-25', kilograms: 100, unexpected: true },
    ])
      expect(() => validateWeightPoints([value])).toThrow('Stored weight record 1 is invalid')
    expect(() =>
      validateWeightPoints([
        { date: '2026-07-25', kilograms: 100 },
        { date: '2026-07-25', kilograms: 99 },
      ]),
    ).toThrow('Stored weight dates must be unique and increasing')
  })
})

describe('weight presentation calculations', () => {
  it('calculates total change and chart bounds', () => {
    const points = [
      { date: '2026-01-01', kilograms: 80 },
      { date: '2026-02-02', kilograms: 82 },
    ]
    expect(weightChange(points)).toBe(2)
    expect(weightChange(points.slice(0, 1))).toBe(0)
    expect(weightDomain(points)).toEqual([79, 83])
  })

  it('formats calendar dates independently of local timezone', () => {
    expect(formatMeasurementDate('2026-08-13', 'short')).toMatch(/13/)
    expect(formatMeasurementDate('2026-08-13')).toMatch(/2026/)
  })
})
