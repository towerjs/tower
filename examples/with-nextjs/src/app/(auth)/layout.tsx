export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <a href="/" className="text-xl font-bold tracking-tight">
            Tower
          </a>
          <p className="mt-1 text-sm text-neutral-500">+ Next.js</p>
        </div>
        {children}
      </div>
    </div>
  )
}
