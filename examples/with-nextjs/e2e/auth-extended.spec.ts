import { type Page, expect, test } from '@playwright/test'

const PASSWORD = 'Password123!'
const NEW_PASSWORD = 'NewPassword789!'

async function signUp(page: Page, email: string, name = 'Test User') {
  await page.goto('/sign-up')
  await expect(page.getByText('Create an account')).toBeVisible()
  await page.fill('[name="name"]', name)
  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
  await expect(page.getByText(`Welcome back, ${name}`)).toBeVisible()
}

async function signOut(page: Page) {
  await page.click('button:has-text("Sign out")')
  await page.waitForURL('**/sign-in')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
}

test.describe('Extended auth flows', () => {
  test('incorrect sign-in shows error message', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()

    await page.fill('[name="email"]', 'wrong@example.com')
    await page.fill('[name="password"]', 'WrongPassword!')
    await page.click('button[type="submit"]')

    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 15000 })
  })

  test('update profile name with success feedback', async ({ page }) => {
    const email = `profile-${Date.now()}@example.com`
    const newName = 'Updated Name'

    await signUp(page, email)

    await page.getByRole('link', { name: 'Settings' }).first().click()
    await page.waitForURL('**/dashboard/settings')

    await page.fill('[name="name"]', newName)
    await page.click('button:has-text("Save changes")')

    await expect(page.getByText('Profile updated')).toBeVisible({ timeout: 15000 })

    await page.getByRole('link', { name: 'Home' }).first().click()
    await page.waitForURL('**/dashboard')
    await expect(page.getByText(`Welcome back, ${newName}`)).toBeVisible()
  })

  test('change password then sign in with new and old passwords', async ({ page }) => {
    const email = `password-${Date.now()}@example.com`

    await signUp(page, email)

    await page.getByRole('link', { name: 'Settings' }).first().click()
    await page.waitForURL('**/dashboard/settings')

    await page.fill('[name="currentPassword"]', PASSWORD)
    await page.fill('[name="newPassword"]', NEW_PASSWORD)
    await page.click('button:has-text("Update password")')
    await expect(page.getByText('Password updated')).toBeVisible({ timeout: 15000 })

    await signOut(page)

    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', NEW_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    await expect(page.getByText('Welcome back, Test User')).toBeVisible()

    await signOut(page)

    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 15000 })
  })

  test('create organization, invite member, cancel invitation', async ({ page }) => {
    const email = `org-${Date.now()}@example.com`
    const orgName = `Test Org ${Date.now()}`
    const orgSlug = `test-org-${Date.now()}`
    const inviteEmail = `invited-${Date.now()}@example.com`

    await signUp(page, email)

    await page.getByRole('link', { name: 'Organizations' }).first().click()
    await page.waitForURL('**/dashboard/organizations')

    await page.fill('[name="name"]', orgName)
    await page.fill('[name="slug"]', orgSlug)
    await page.click('button:has-text("Create")')

    await expect(page.getByText(orgName)).toBeVisible({ timeout: 15000 })

    await page.getByText(orgName).click()
    await page.waitForURL('**/dashboard/organizations/**')

    await expect(page.getByText('1 member')).toBeVisible()

    await page.fill('#invite-email', inviteEmail)
    await page.selectOption('#invite-role', 'admin')
    await page.click('button:has-text("Send invitation")')
    await expect(page.getByText('Invitation sent')).toBeVisible({ timeout: 15000 })

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(inviteEmail)).toBeVisible()

    await page.click('button:has-text("Cancel")')
    await page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/dashboard/organizations/'))

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(inviteEmail)).not.toBeVisible()
  })

  test('revoke all other sessions from security page', async ({ page }) => {
    const email = `sessions-${Date.now()}@example.com`

    await signUp(page, email)

    await page.getByRole('link', { name: 'Security' }).first().click()
    await page.waitForURL('**/dashboard/security')

    await page.getByRole('button', { name: 'Sessions' }).click()
    await page.click('button:has-text("Revoke all other sessions")')

    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible()
  })

  test('two-factor enable flow shows QR code', async ({ page }) => {
    const email = `2fa-${Date.now()}@example.com`

    await signUp(page, email)

    await page.getByRole('link', { name: 'Security' }).first().click()
    await page.waitForURL('**/dashboard/security')

    await page.fill('#password-2fa', PASSWORD)
    await page.click('button:has-text("Enable two-factor")')

    await expect(page.getByText('Scan this QR code')).toBeVisible({ timeout: 15000 })
  })
})
