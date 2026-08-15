export type WeightPoint = Readonly<{
  date: string
  kilograms: number
}>

const csvHeader = 'date,weight_kg'
const decimalPattern = /^[+-]?\d+(?:\.\d+)?$/

export function parseWeight(rawValue: string | null): number {
  if (rawValue === null || rawValue.trim() === '') throw new Error('Enter a valid weight')
  const kilograms = Number(rawValue.replace(',', '.'))
  if (Number.isNaN(kilograms) && rawValue.trim().toLowerCase() !== 'nan')
    throw new Error('Enter a valid weight')
  if (!Number.isFinite(kilograms) || kilograms < 0 || kilograms > 700)
    throw new Error('Weight must be between 0 and 700 kg')
  return kilograms
}

export function parseMeasurementDate(rawValue: string | null, today: string): string {
  if (!rawValue || !isCalendarDate(rawValue)) throw new Error('Choose a valid measurement date')
  if (rawValue > today) throw new Error('Measurement date cannot be in the future')
  return rawValue
}

export function validateWeightPoints(points: unknown): WeightPoint[] {
  if (!Array.isArray(points)) throw new Error('Weight data must be a list')
  let previousDate = ''
  return points.map((value, index) => {
    if (!isWeightPoint(value)) throw new Error(`Stored weight record ${index + 1} is invalid`)
    if (previousDate && value.date <= previousDate)
      throw new Error('Stored weight dates must be unique and increasing')
    previousDate = value.date
    return { date: value.date, kilograms: value.kilograms }
  })
}

export function parseWeightCsv(
  contents: string | Uint8Array,
  options: { allowGaps?: boolean; allowEmpty?: boolean } = {},
): WeightPoint[] {
  const text = decodeCsv(contents)
  const rows = parseCsvRows(text.startsWith('\uFEFF') ? text.slice(1) : text)
  if (!sameRow(rows[0], ['date', 'weight_kg'])) throw new Error(`Expected header: ${csvHeader}`)

  const points: WeightPoint[] = []
  let previousDate = ''
  for (let index = 1; index < rows.length; index += 1) {
    const lineNumber = index + 1
    const row = rows[index]!
    if (row.length !== 2) throw new Error(`Line ${lineNumber}: expected two columns`)
    const [date, rawWeight] = row as [string, string]
    if (!isCalendarDate(date)) throw new Error(`Line ${lineNumber}: invalid date '${date}'`)
    if (date <= previousDate)
      throw new Error(`Line ${lineNumber}: dates must be unique and increasing`)

    let kilograms: number
    if (rawWeight === 'NaN') {
      if (!options.allowGaps)
        throw new Error(`Line ${lineNumber}: weight must be between 0 and 700 kg`)
      kilograms = Number.NaN
    } else {
      if (!decimalPattern.test(rawWeight))
        throw new Error(`Line ${lineNumber}: invalid weight '${rawWeight}'`)
      kilograms = Number(rawWeight)
      if (!Number.isFinite(kilograms) || kilograms < 0 || kilograms > 700)
        throw new Error(`Line ${lineNumber}: weight must be between 0 and 700 kg`)
    }
    points.push({ date, kilograms })
    previousDate = date
  }
  if (points.length === 0 && !options.allowEmpty) throw new Error('CSV contains no data rows')
  return points
}

export function serializeWeightCsv(
  points: readonly WeightPoint[],
  options: { allowGaps?: boolean } = {},
): string {
  let previousDate = ''
  const rows = points.map(({ date, kilograms }, index) => {
    const lineNumber = index + 2
    if (!isCalendarDate(date)) throw new Error(`Line ${lineNumber}: invalid date '${date}'`)
    if (date <= previousDate)
      throw new Error(`Line ${lineNumber}: dates must be unique and increasing`)
    previousDate = date
    if (Number.isNaN(kilograms) && options.allowGaps) return `${date},NaN`
    if (!Number.isFinite(kilograms) || kilograms < 0 || kilograms > 700)
      throw new Error(`Line ${lineNumber}: weight must be between 0 and 700 kg`)
    return `${date},${decimalText(kilograms)}`
  })
  return `${csvHeader}\n${rows.length ? `${rows.join('\n')}\n` : ''}`
}

export function weightChange(points: readonly WeightPoint[]): number {
  if (points.length < 2) return 0
  return points.at(-1)!.kilograms - points[0]!.kilograms
}

export function weightDomain(points: readonly WeightPoint[]): [number, number] {
  const values = points.map(({ kilograms }) => kilograms)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const padding = Math.max((maximum - minimum) * 0.2, 0.8)
  return [Math.floor((minimum - padding) * 2) / 2, Math.ceil((maximum + padding) * 2) / 2]
}

export function formatMeasurementDate(date: string, style: 'short' | 'long' = 'long'): string {
  const value = new Date(`${date}T12:00:00Z`)
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: style === 'short' ? 'short' : 'long',
    ...(style === 'long' ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(value)
}

function isWeightPoint(value: unknown): value is WeightPoint {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    Object.keys(record).length === 2 &&
    isCalendarDate(record.date) &&
    typeof record.kilograms === 'number' &&
    Number.isFinite(record.kilograms) &&
    record.kilograms >= 0 &&
    record.kilograms <= 700
  )
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  if (year < 1) return false
  const parsed = new Date(0)
  parsed.setUTCHours(0, 0, 0, 0)
  parsed.setUTCFullYear(year, month - 1, day)
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function decodeCsv(contents: string | Uint8Array): string {
  if (typeof contents === 'string') return contents
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(contents)
  } catch {
    throw new Error('CSV must use UTF-8 encoding')
  }
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let closedQuote = false

  function finishField() {
    row.push(field)
    field = ''
    closedQuote = false
  }
  function finishRow() {
    finishField()
    rows.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!
    if (quoted) {
      if (character !== '"') {
        field += character
      } else if (text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = false
        closedQuote = true
      }
    } else if (character === '"' && field === '' && !closedQuote) {
      quoted = true
    } else if (character === ',' && !closedQuote) {
      finishField()
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      finishRow()
    } else if (closedQuote) {
      if (character === ',') finishField()
      else throw new Error('Invalid CSV: unexpected character after closing quote')
    } else {
      field += character
    }
  }
  if (quoted) throw new Error('Invalid CSV: unexpected end of data')
  if (field || row.length || closedQuote) finishRow()
  return rows
}

function sameRow(left: string[] | undefined, right: string[]): boolean {
  return left?.length === right.length && left.every((value, index) => value === right[index])
}

function decimalText(value: number): string {
  const text = String(value)
  if (!/[eE]/.test(text)) return text
  const [coefficient, rawExponent] = text.toLowerCase().split('e') as [string, string]
  const digits = coefficient.replace('.', '')
  return `0.${'0'.repeat(Math.abs(Number(rawExponent)) - 1)}${digits}`
}
