import type { WeightPoint } from '../domain/weight'

const startDate = Date.parse('2026-04-18T12:00:00Z')
const endDate = Date.parse('2026-09-15T12:00:00Z')
const durationDays = Math.round((endDate - startDate) / 86_400_000)

export const samplePlanPoints: readonly WeightPoint[] = Array.from(
  { length: durationDays + 1 },
  (_, index) => ({
    date: new Date(startDate + index * 86_400_000).toISOString().slice(0, 10),
    kilograms: 82.4 + ((75 - 82.4) * index) / durationDays,
  }),
)
