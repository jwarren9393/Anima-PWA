import type { ReactNode } from 'react'

type Props = {
  title: string
  onBack?: () => void
  trailing?: ReactNode
}

export function PageHeader({ title, onBack, trailing }: Props) {
  return (
    <header className="mb-4 flex items-center gap-2 px-1">
      {onBack && (
        <button
          type="button"
          className="btn-ghost px-2 text-lg text-[color:var(--color-accent)]"
          onClick={onBack}
        >
          ←
        </button>
      )}
      <h1 className="font-heading min-w-0 flex-1 truncate text-2xl font-semibold">{title}</h1>
      {trailing}
    </header>
  )
}
