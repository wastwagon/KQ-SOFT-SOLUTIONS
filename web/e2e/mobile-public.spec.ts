import { expect, test } from '@playwright/test'

test.describe('mobile public surfaces', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('landing navigation menu opens', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).toBeVisible()
    await expect(
      page.getByRole('dialog', { name: 'Mobile navigation' }).getByRole('link', { name: 'FAQ' })
    ).toBeVisible()
  })

  test('login layout fits narrow viewport', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'OceanCyber' })).toBeVisible()
  })
})
