import { expect, test } from '@playwright/test'

test.describe('public smoke', () => {
  test('landing page loads with brand', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /KQ-SOFT home|KQ-SOFT/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible()
  })

  test('privacy policy page', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
    await expect(page.getByText(/^Last updated /)).toBeVisible()
  })

  test('terms of service page', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible()
  })

  test('login form is reachable', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first()).toBeVisible()
  })

  test('register links to terms and privacy', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible()
  })
})
