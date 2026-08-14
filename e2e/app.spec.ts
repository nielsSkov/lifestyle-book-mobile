import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('presents one responsive and accessible weight experience', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname !== '127.0.0.1') externalRequests.push(request.url())
  })
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'A quieter view of progress.' })).toBeVisible()
  await expect(page.getByTestId('weight-chart')).toBeVisible()
  await expect(page.getByLabel('77.2 kilograms')).toBeVisible()

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
  expect(externalRequests).toEqual([])
})

test('reloads after the network is disconnected', async ({ page, context }) => {
  await page.goto('./')
  await expect(page.getByTestId('weight-chart')).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'A quieter view of progress.' })).toBeVisible()
  await expect(page.getByTestId('weight-chart')).toBeVisible()
})

test('exposes a complete installable manifest', async ({ request }) => {
  const manifestResponse = await request.get('./manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)
  const manifest = await manifestResponse.json()

  expect(manifest.name).toBe('Lifestyle Book')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons).toHaveLength(3)
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true)
  }
})
