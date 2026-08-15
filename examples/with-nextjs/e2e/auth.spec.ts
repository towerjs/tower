import { expect, test } from '@playwright/test'

const TEST_USER = {
  name: 'Test User',
  email: `test-${Date.now()}@example.com`,
  password: 'Password123!',
}

test.describe('Gatehouse auth', () => {
  test('unauthenticated user is redirected to sign in', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/sign-in')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('user can sign up', async ({ page }) => {
    await page.goto('/sign-up')
    await expect(page.getByText('Create an account')).toBeVisible()

    await page.fill('[name="name"]', TEST_USER.name)
    await page.fill('[name="email"]', TEST_USER.email)
    await page.fill('[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')

    await page.waitForURL('**/dashboard')
    await expect(page.getByText(`Welcome back, ${TEST_USER.name}`)).toBeVisible()
  })

  test('sign-up works with email verification enabled', async ({ page }) => {
    const email = `verified-${Date.now()}@example.com`
    await page.goto('/sign-up')
    await page.fill('[name="name"]', 'Verified User')
    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')

    await page.waitForURL('**/dashboard')
    await expect(page.getByText('Welcome back, Verified User')).toBeVisible()
  })

  test('user can sign out', async ({ page }) => {
    const email = `signout-${Date.now()}@example.com`
    await page.goto('/sign-up')
    await page.fill('[name="name"]', 'Sign Out User')
    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')

    await page.click('button:has-text("Sign out")')
    await page.waitForURL('**/sign-in')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('user can sign in after sign out', async ({ page }) => {
    const email = `signin-${Date.now()}@example.com`
    await page.goto('/sign-up')
    await page.fill('[name="name"]', 'Sign In User')
    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')

    await page.click('button:has-text("Sign out")')
    await page.waitForURL('**/sign-in')

    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')

    await page.waitForURL('**/dashboard')
    await expect(page.getByText('Welcome back, Sign In User')).toBeVisible()
  })

  test('session persists after reload', async ({ page }) => {
    const email = `reload-${Date.now()}@example.com`
    await page.goto('/sign-up')
    await page.fill('[name="name"]', 'Reload User')
    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Welcome back, Reload User')).toBeVisible()
  })
})
