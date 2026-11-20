import type { ReactNode } from 'react'

export type AppView =
  | 'home'
  | 'characters'
  | 'personas'
  | 'lore'
  | 'api'
  | 'backup'
  | 'chat'

type Props = {
  view: AppView
  onNavigate: (view: AppView) => void
  children: ReactNode
  hideChrome?: boolean
}

const navItems: { id: AppView; label: string; short: string }[] = [
  { id: 'home', label: 'Home', short: 'Home' },
  { id: 'characters', label: 'Characters', short: 'Cards' },
  { id: 'personas', label: 'Personas', short: 'You' },
  { id: 'lore', label: 'Lorebooks', short: 'Lore' },
  { id: 'api', label: 'API & connection', short: 'API' },
  { id: 'backup', label: 'Backup & restore', short: 'Backup' },
]

export function AppShell({ view, onNavigate, children, hideChrome }: Props) {
  const mobileNav = navItems.filter((i) =>
    ['home', 'characters', 'personas', 'lore', 'api'].includes(i.id),
  )

  if (hideChrome) {
    return <div className="min-h-full">{children}</div>
  }

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="glass-panel hidden w-60 shrink-0 flex-col border-r border-white/5 md:flex">
        <div className="border-b border-white/5 px-5 py-6">
          <div
            className="text-2xl font-semibold gold-text"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Anima
          </div>
          <p className="mt-1 text-xs text-white/40">Local-first PWA · Phase 2</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = view === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? 'bg-gold-500/15 text-gold-400'
                    : 'text-white/65 hover:bg-white/5 hover:text-white/90'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:hidden">
          <div
            className="text-xl font-semibold gold-text"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Anima
          </div>
          <span className="text-xs text-white/40">Phase 2</span>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:pb-8">
          {children}
        </main>

        <nav className="glass-panel fixed inset-x-0 bottom-0 z-20 border-t border-white/5 md:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
            {mobileNav.map((item) => {
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`rounded-xl px-1 py-2.5 text-center text-[11px] font-medium ${
                    active ? 'bg-gold-500/15 text-gold-400' : 'text-white/55'
                  }`}
                >
                  {item.short}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
