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

test('public activity detail panel opens with charts and closes from the keyboard', async ({ page }) => {
  await page.goto('/dashboard')

  await page.getByRole('button', { name: /12\.2 mile run/i }).click()
  const dialog = page.getByRole('dialog', { name: /activity detail/i })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/measured effort/i)).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Pace', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('mobile public layout does not overflow horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
})

test('kudos button shows the shared count and accepts a single kudos', async ({ page }) => {
  let count = 41
  await page.route('**/api/kudos', (route) => {
    if (route.request().method() === 'POST') {
      count += 1
      return route.fulfill({ json: { count, counted: true } })
    }
    return route.fulfill({ json: { count } })
  })
  await page.goto('/')

  const button = page.getByRole('button', { name: /give kudos/i })
  await expect(button).toContainText('41')
  await button.click()
  const given = page.getByRole('button', { name: /kudos given/i })
  await expect(given).toContainText('42')
  await expect(given).toBeDisabled()
})

test('kudos button stays hidden when the counter service is unavailable', async ({ page }) => {
  await page.route('**/api/kudos', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Kudos is not configured.' }),
  }))
  await page.goto('/')

  await expect(page.getByText(/states reached/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /kudos/i })).toHaveCount(0)
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
