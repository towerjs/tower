import { getSession } from 'towerjs/gatehouse/next'
import { signOut } from '@/app/actions'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/security', label: 'Security' },
  { href: '/dashboard/organizations', label: 'Organizations' },
  { href: '/dashboard/courier', label: 'Courier' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="text-sm font-bold tracking-tight">
            Tower
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {session && (
            <>
              <span className="hidden text-sm text-neutral-500 md:block">{session.user.email}</span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  Sign out
                </button>
              </form>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-56 shrink-0 border-r border-neutral-200 p-4 md:block">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
