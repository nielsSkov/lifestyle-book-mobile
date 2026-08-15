import { deleteDB, openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'

import {
  deleteWeightPoint,
  loadWeightPoints,
  replaceWeightPoints,
  saveWeightPoint,
  weightDatabaseName,
  weightDatabaseVersion,
  weightStoreName,
} from './weightRepository'

afterEach(() => deleteDB(weightDatabaseName))

describe('weight repository', () => {
  it('starts empty and persists sorted upserts without filling date gaps', async () => {
    expect(await loadWeightPoints()).toEqual([])

    await saveWeightPoint({ date: '2026-07-29', kilograms: 109.4 })
    await saveWeightPoint({ date: '2026-07-25', kilograms: 109.8 })
    await saveWeightPoint({ date: '2026-07-27', kilograms: 109.6 })
    await saveWeightPoint({ date: '2026-07-25', kilograms: 109.7 })

    expect(await loadWeightPoints()).toEqual([
      { date: '2026-07-25', kilograms: 109.7 },
      { date: '2026-07-27', kilograms: 109.6 },
      { date: '2026-07-29', kilograms: 109.4 },
    ])
  })

  it('deletes only an existing selected measurement, including the final one', async () => {
    await saveWeightPoint({ date: '2026-07-25', kilograms: 109.8 })
    expect(await deleteWeightPoint('2026-07-26')).toBe(false)
    expect(await deleteWeightPoint('2026-07-25')).toBe(true)
    expect(await loadWeightPoints()).toEqual([])
  })

  it('atomically replaces a validated dataset', async () => {
    await saveWeightPoint({ date: '2026-07-25', kilograms: 109.8 })
    await replaceWeightPoints([
      { date: '2026-08-01', kilograms: 108.5 },
      { date: '2026-08-02', kilograms: 108.4 },
    ])
    expect(await loadWeightPoints()).toEqual([
      { date: '2026-08-01', kilograms: 108.5 },
      { date: '2026-08-02', kilograms: 108.4 },
    ])
    await expect(
      replaceWeightPoints([
        { date: '2026-08-02', kilograms: 108.4 },
        { date: '2026-08-01', kilograms: 108.5 },
      ]),
    ).rejects.toThrow('unique and increasing')
  })

  it('rejects the complete load when a stored record is corrupt', async () => {
    const db = await openDB(weightDatabaseName, weightDatabaseVersion, {
      upgrade(database) {
        database.createObjectStore(weightStoreName, { keyPath: 'date' })
      },
    })
    await db.put(weightStoreName, { date: '2026-07-25', kilograms: 701 })
    db.close()
    await expect(loadWeightPoints()).rejects.toThrow('Stored weight record 1 is invalid')
  })

  it('clears version-1 prototype seed records during schema migration', async () => {
    const oldDatabase = await openDB(weightDatabaseName, 1, {
      upgrade(database) {
        database.createObjectStore(weightStoreName, { keyPath: 'date' })
      },
    })
    await oldDatabase.put(weightStoreName, { date: '2026-04-18', kilograms: 82.6 })
    oldDatabase.close()

    expect(await loadWeightPoints()).toEqual([])
    const migrated = await openDB(weightDatabaseName)
    expect(migrated.version).toBe(weightDatabaseVersion)
    migrated.close()
  })
})
