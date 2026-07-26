type InputProps = {
  label?: string
  error?: string
  className?: string
} & React.InputHTMLAttributes<HTMLInputElement>

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={props.id} className="block text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      <input
        className={`block w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-neutral-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
