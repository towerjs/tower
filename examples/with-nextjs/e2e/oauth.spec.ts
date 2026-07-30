import { test, expect } from '@playwright/test'

const hasGoogle = !!process.env.GOOGLE_CLIENT_ID
const hasGithub = !!process.env.GITHUB_CLIENT_ID

test.describe('OAuth providers', () => {
  test('Google provider button is present', async ({ page }) => {
    test.skip(!hasGoogle, 'GOOGLE_CLIENT_ID not configured')

    await page.goto('/sign-in')
    await expect(page.locator('a[href*="google"]')).toBeVisible()
  })

  test('GitHub provider button is present', async ({ page }) => {
    test.skip(!hasGithub, 'GITHUB_CLIENT_ID not configured')

    await page.goto('/sign-in')
    await expect(page.locator('a[href*="github"]')).toBeVisible()
  })
})
