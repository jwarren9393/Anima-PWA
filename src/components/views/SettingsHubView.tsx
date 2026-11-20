type Props = {
  modelLabel?: string
  hasApiKey?: boolean
  onOpen: (target:
    | 'api'
    | 'personas'
    | 'characters'
    | 'lore'
    | 'backup'
    | 'creationCenter'
    | 'appearance'
    | 'comingSoon'
    , title?: string) => void
  onBack: () => void
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="px-1 pb-1 pt-5 text-sm font-semibold tracking-wide text-[color:var(--color-accent)]">
      {children}
    </h2>
  )
}

function Row({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string
  title: string
  subtitle?: string
  onClick: () => void
}) {
  return (
    <button type="button" className="settings-row" onClick={onClick}>
      <span className="text-lg text-[color:var(--color-accent)]" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {subtitle && <span className="block text-sm text-[color:var(--color-muted)]">{subtitle}</span>}
      </span>
      <span className="text-[color:var(--color-muted)]">›</span>
    </button>
  )
}

export function SettingsHubView({ modelLabel, hasApiKey, onOpen, onBack }: Props) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-2">
      <header className="mb-4 flex items-center gap-2">
        <button type="button" className="btn-ghost px-2 text-[color:var(--color-accent)]" onClick={onBack}>
          ←
        </button>
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
      </header>

      <button
        type="button"
        className="glass-panel mb-2 flex w-full items-center gap-3 px-4 py-4 text-left"
        onClick={() => onOpen('api')}
      >
        <span className="text-xl text-[color:var(--color-accent)]">🔗</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">API & connection</span>
          <span className="block text-sm text-[color:var(--color-muted)]">
            {hasApiKey
              ? `Model: ${modelLabel || 'selected'}`
              : 'No API key'}
          </span>
        </span>
        <span className="text-[color:var(--color-muted)]">›</span>
      </button>

      <SectionLabel>World</SectionLabel>
      <div className="glass-panel px-3">
        <Row icon="👤" title="Personas" onClick={() => onOpen('personas')} />
        <Row icon="👥" title="Characters" onClick={() => onOpen('characters')} />
        <Row icon="📖" title="World Info & lore" onClick={() => onOpen('lore')} />
        <Row
          icon="🔍"
          title="Creation Center"
          onClick={() => onOpen('creationCenter')}
        />
        <Row
          icon="🌐"
          title="Living Worlds"
          subtitle="Optional notebooks + factory — off until you bind a chat"
          onClick={() => onOpen('comingSoon', 'Living Worlds')}
        />
      </div>

      <SectionLabel>AI</SectionLabel>
      <div className="glass-panel px-3">
        <Row
          icon="🎚"
          title="Generation parameters"
          onClick={() => onOpen('comingSoon', 'Generation parameters')}
        />
        <Row
          icon="📄"
          title="Global chat prompts"
          onClick={() => onOpen('comingSoon', 'Global chat prompts')}
        />
        <Row
          icon="✨"
          title="AI collaborator"
          subtitle="Field wands, Creation Center chat, Paths, Narrator"
          onClick={() => onOpen('comingSoon', 'AI collaborator')}
        />
        <Row
          icon="🪪"
          title="Character & persona builds"
          subtitle="Model, sampling, and prompts for full card JSON"
          onClick={() => onOpen('comingSoon', 'Character & persona builds')}
        />
      </div>

      <SectionLabel>App</SectionLabel>
      <div className="glass-panel px-3">
        <Row
          icon="📁"
          title="Data folder"
          onClick={() => onOpen('comingSoon', 'Data folder')}
        />
        <Row
          icon="🎨"
          title="Appearance"
          onClick={() => onOpen('appearance')}
        />
        <Row
          icon="☁"
          title="Backup, restore & sync"
          onClick={() => onOpen('backup')}
        />
      </div>

      <p className="mt-6 px-1 text-xs text-[color:var(--color-muted)]">
        NanoGPT key is stored in this browser&apos;s IndexedDB only. It is never included in
        .anima-backup exports.
      </p>
    </div>
  )
}
