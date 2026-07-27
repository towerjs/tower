import Link from 'next/link'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Tower
          </Link>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">+ Next.js</p>
        </div>
        {children}
      </div>
    </div>
  )
}
