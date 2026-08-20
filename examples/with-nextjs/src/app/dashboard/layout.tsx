import { SignOutButton } from '@/components/sign-out-button'

import { gatehouse } from '@towerjs/gatehouse'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/security', label: 'Security' },
  { href: '/dashboard/organizations', label: 'Organizations' },
  { href: '/dashboard/courier', label: 'Email' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await gatehouse.getSession()
  if (!session) redirect('/sign-in')
  const { user } = session

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-bold tracking-tight">
            Tower
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-500 dark:text-neutral-400 md:block">{user.email}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-56 shrink-0 border-r border-neutral-200 p-4 md:block dark:border-neutral-800">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
