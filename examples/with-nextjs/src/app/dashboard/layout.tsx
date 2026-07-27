import Link from 'next/link'
import { gatehouse } from 'towerjs/gatehouse'
import { signOut } from '@/app/actions'

export const dynamic = 'force-dynamic'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/security', label: 'Security' },
  { href: '/dashboard/organizations', label: 'Organizations' },
  { href: '/dashboard/courier', label: 'Courier' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await gatehouse.requireUser()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-bold tracking-tight">
            Tower
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-500 md:block">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-56 shrink-0 border-r border-neutral-200 p-4 md:block">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
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
