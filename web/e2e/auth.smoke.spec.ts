import { expect, test } from '@playwright/test'

/**
 * Authenticated smoke — skipped unless E2E_EMAIL + E2E_PASSWORD are set
 * (seed defaults: premium@test.com / Test123!).
 *
 * Requires a running API behind the web app (PLAYWRIGHT_BASE_URL or Vite preview
 * with VITE_API_PROXY_TARGET / VITE_API_URL pointing at the API).
 */
const email = process.env.E2E_EMAIL || ''
const password = process.env.E2E_PASSWORD || ''
const hasCreds = Boolean(email && password)

test.describe('authenticated smoke', () => {
  test.skip(!hasCreds, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke')

  test('login reaches dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.locator('#login-password').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
    await expect(page.getByText(/dashboard|projects|welcome/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('workspace nav: projects, clients, settings', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.locator('#login-password').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })

    await page.getByRole('link', { name: /^Projects$/i }).first().click()
    await expect(page).toHaveURL(/\/projects/, { timeout: 15_000 })

    await page.getByRole('link', { name: /^Clients$/i }).first().click()
    await expect(page).toHaveURL(/\/clients/, { timeout: 15_000 })

    await page.getByRole('link', { name: /^Settings$/i }).first().click()
    await expect(page).toHaveURL(/\/settings/, { timeout: 15_000 })
  })
})
