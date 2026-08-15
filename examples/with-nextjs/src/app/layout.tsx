import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Tower + Next.js',
  description: 'Full-stack application services powered by Tower and Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body
        className="min-h-full bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100"
        style={{ fontFamily: 'InterVariable, Arial, Helvetica, sans-serif' }}
      >
        {children}
      </body>
    </html>
  )
}
