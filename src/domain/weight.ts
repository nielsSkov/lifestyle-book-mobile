export type WeightPoint = Readonly<{
  date: string
  kilograms: number
}>

export function sortWeightPoints(points: readonly WeightPoint[]): WeightPoint[] {
  return points
    .filter(({ date, kilograms }) => /^\d{4}-\d{2}-\d{2}$/.test(date) && kilograms > 0)
    .toSorted((left, right) => left.date.localeCompare(right.date))
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
