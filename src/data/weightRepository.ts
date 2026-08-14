import { openDB } from 'idb'

import type { WeightPoint } from '../domain/weight'
import { sortWeightPoints } from '../domain/weight'
import { sampleWeightPoints } from './sampleWeightPoints'

const databaseName = 'lifestyle-book'
const storeName = 'weight-points'

async function database() {
  return openDB(databaseName, 1, {
    upgrade(db) {
      db.createObjectStore(storeName, { keyPath: 'date' })
    },
  })
}

export async function loadWeightPoints(): Promise<WeightPoint[]> {
  const db = await database()
  try {
    const existing = (await db.getAll(storeName)) as WeightPoint[]
    if (existing.length > 0) return sortWeightPoints(existing)

    const transaction = db.transaction(storeName, 'readwrite')
    await Promise.all([
      ...sampleWeightPoints.map((point) => transaction.store.put(point)),
      transaction.done,
    ])
    return sortWeightPoints(sampleWeightPoints)
  } finally {
    db.close()
  }
}
