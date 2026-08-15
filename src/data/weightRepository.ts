import { openDB } from 'idb'

import type { WeightPoint } from '../domain/weight'
import { validateWeightPoints } from '../domain/weight'

export const weightDatabaseName = 'lifestyle-book'
export const weightDatabaseVersion = 2
export const weightStoreName = 'weight-points'

async function database() {
  return openDB(weightDatabaseName, weightDatabaseVersion, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) db.createObjectStore(weightStoreName, { keyPath: 'date' })
      // Version 1 contained only automatically seeded prototype measurements.
      if (oldVersion === 1) transaction.objectStore(weightStoreName).clear()
    },
  })
}

export async function loadWeightPoints(): Promise<WeightPoint[]> {
  const db = await database()
  try {
    return validateWeightPoints(await db.getAll(weightStoreName))
  } finally {
    db.close()
  }
}

export async function saveWeightPoint(point: WeightPoint): Promise<void> {
  const [validated] = validateWeightPoints([point])
  const db = await database()
  try {
    await db.put(weightStoreName, validated)
  } finally {
    db.close()
  }
}

export async function deleteWeightPoint(date: string): Promise<boolean> {
  const db = await database()
  try {
    const transaction = db.transaction(weightStoreName, 'readwrite')
    const exists = (await transaction.store.getKey(date)) !== undefined
    if (exists) await transaction.store.delete(date)
    await transaction.done
    return exists
  } finally {
    db.close()
  }
}

export async function replaceWeightPoints(points: readonly WeightPoint[]): Promise<void> {
  const validated = validateWeightPoints(points)
  const db = await database()
  try {
    const transaction = db.transaction(weightStoreName, 'readwrite')
    await transaction.store.clear()
    for (const point of validated) await transaction.store.put(point)
    await transaction.done
  } finally {
    db.close()
  }
}
