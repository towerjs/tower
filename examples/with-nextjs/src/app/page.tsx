import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Tower
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/sign-in"
            className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 pt-32 pb-20 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Everything you need to build
            <br />
            <span className="text-neutral-500 dark:text-neutral-400">production-grade apps</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-500 dark:text-neutral-400">
            Tower provides auth, database, email, SMS, push notifications, and more — all integrated with Next.js out of
            the box.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Get started
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-32">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Auth',
                description:
                  'Email, magic links, OTP, social login, 2FA, passkeys, organizations, API keys — powered by Better Auth.',
              },
              {
                title: 'Database',
                description:
                  'PostgreSQL via Kysely with type-safe queries, migrations, and seeds. Neon or standard pg.',
              },
              {
                title: 'Communications',
                description: 'Email (Resend, SES, SMTP), SMS, and push notifications through a unified API.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
