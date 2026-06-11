import { expect, test } from '@playwright/test'

test('public landing page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /lifetime movement/i })).toBeVisible()
  await expect(page.getByText(/states reached/i)).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
})

test('public dashboard renders coaching, trends, sample weather, and the demo activity feed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Dashboard' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: /what should you run today/i })).toBeVisible()
  await expect(page.getByText(/easy aerobic run/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /weekly mileage/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /recent activities/i })).toBeVisible()
  await expect(page.getByText(/good conditions for a run/i)).toBeVisible()
  await expect(page.getByText('12 shown')).toBeVisible()
})

test('mobile public layout does not overflow horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
})

test('owner unlock dialog closes with Escape and restores the page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Owner' }).click()
  await expect(page.getByRole('dialog', { name: /unlock owner mode/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /unlock owner mode/i })).toBeHidden()
  await expect(page.locator('body')).toHaveCSS('overflow', 'visible')
})

test('mobile dashboard does not overflow horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dashboard')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(page.getByRole('heading', { name: /performance console/i })).toBeVisible()
})

test('mocked owner can unlock and lock without exposing provider calls to public mode', async ({ page }) => {
  await page.route('**/api/owner-session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ authenticated: false }),
  }))
  await page.route('**/api/owner-login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ authenticated: true }),
  }))
  await page.route('**/api/owner-logout', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ authenticated: false }),
  }))
  await page.route('**/api/strava', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Strava connection required.' }),
  }))

  await page.goto('/')
  await page.getByRole('button', { name: 'Owner' }).click()
  await page.getByLabel('Password').fill('test-owner-password')
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()

  await expect(page.getByText('owner', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Lock' }).click()
  await expect(page.getByText('public', { exact: true })).toBeVisible()
})
