type CardProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-6 shadow-none dark:border-neutral-800 dark:bg-neutral-950 dark:inset-ring dark:inset-ring-white/5 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold text-neutral-900 dark:text-neutral-100 ${className}`}>{children}</h3>
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-1 text-sm text-neutral-500 dark:text-neutral-400 ${className}`}>{children}</p>
}
