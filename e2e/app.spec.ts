import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test('presents one responsive and accessible weight experience', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname !== '127.0.0.1') externalRequests.push(request.url())
  })
  await seedWeightData(page)

  await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible()
  await expect(page.getByTestId('weight-plot')).toBeVisible()
  await expect(page.locator('.modebar-btn')).toHaveCount(3)
  await page.locator('.nsewdrag').hover({ position: { x: 120, y: 120 } })
  await expect(page.locator('.plot-readout')).toBeVisible()

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
  expect(externalRequests).toEqual([])
})

test('reloads after the network is disconnected', async ({ page, context }) => {
  await seedWeightData(page)
  await expect(page.getByTestId('weight-plot')).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible()
  await expect(page.getByTestId('weight-plot')).toBeVisible()
})

test('supports Plotly zoom, pan, reset, and focus without substitute controls', async ({
  page,
}) => {
  await seedWeightData(page)
  const plot = page.getByTestId('weight-plot')
  const dragLayer = page.locator('.nsewdrag')
  await expect(dragLayer).toBeVisible()
  await expect(page.locator('input[type="range"]')).toHaveCount(0)
  await expect(page.locator('.modebar-btn[data-title="Zoom"]')).toBeVisible()
  await expect(page.locator('.modebar-btn[data-title="Pan"]')).toBeVisible()
  await expect(page.locator('.modebar-btn[data-title="Reset axes"]')).toBeVisible()

  const initialRange = await plot.evaluate((element: PlotlyElement) => [
    ...element.layout.xaxis.range,
  ])
  const bounds = await dragLayer.boundingBox()
  expect(bounds).not.toBeNull()
  await page.locator('.modebar-btn[data-title="Zoom"]').click()
  await page.mouse.move(bounds!.x + bounds!.width * 0.2, bounds!.y + bounds!.height * 0.3)
  await page.mouse.down()
  await page.mouse.move(bounds!.x + bounds!.width * 0.75, bounds!.y + bounds!.height * 0.75)
  await page.mouse.up()
  const zoomedRange = await plot.evaluate((element: PlotlyElement) => [
    ...element.layout.xaxis.range,
  ])
  expect(zoomedRange).not.toEqual(initialRange)

  await page.locator('.modebar-btn[data-title="Pan"]').click()
  await page.locator('.modebar-btn[data-title="Reset axes"]').click()
  await dragLayer.dblclick()
  const outline = await plot.evaluate((element) => getComputedStyle(element).outlineStyle)
  expect(outline).toBe('none')
})

test('exposes a complete installable manifest', async ({ request }) => {
  const manifestResponse = await request.get('./manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)
  const manifest = await manifestResponse.json()

  expect(manifest.name).toBe('Lifestyle Book')
  expect(manifest.short_name).toBe('Lifestyle Book')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons).toHaveLength(3)
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true)
  }
})

test('synchronizes a connected Google Drive automatically', async ({ page }) => {
  let driveReads = 0
  await page.addInitScript(() => {
    localStorage.setItem('lifestyle-book.google-drive-credential', 'sealed-proof')
  })
  await page.route('https://broker.example/token', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'proof-access', expiresIn: 3600 }),
    }),
  )
  await page.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.searchParams.get('alt') === 'media') {
      driveReads += 1
      return route.fulfill({
        contentType: 'text/csv',
        body: 'date,weight_kg\n2026-08-14,77.5\n',
      })
    }
    const query = url.searchParams.get('q') ?? ''
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        files: [{ id: query.includes('mimeType') ? 'folder-id' : 'file-id' }],
      }),
    })
  })

  await page.goto('./')
  await expect.poll(() => driveReads).toBeGreaterThan(0)
  await page.getByRole('link', { name: 'Options' }).click()
  await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Google Drive' })).toBeVisible()
  await expect(page.getByText('Connected', { exact: true })).toBeVisible()
  await expect(page.getByText('Up to date.')).toBeVisible()
  await expect(page.getByText('Synchronization proof')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save test row' })).toHaveCount(0)
})

type PlotlyElement = HTMLElement & {
  layout: { xaxis: { range: unknown[] } }
}

async function seedWeightData(page: Page) {
  await page.goto('./')
  await page.evaluate(
    (points) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('lifestyle-book', 2)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction('weight-points', 'readwrite')
          for (const point of points) transaction.objectStore('weight-points').put(point)
          transaction.onerror = () => reject(transaction.error)
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
        }
      }),
    [
      { date: '2026-07-25', kilograms: 78.1 },
      { date: '2026-08-14', kilograms: 77.2 },
    ],
  )
  await page.reload()
}
