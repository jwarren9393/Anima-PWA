import { useEffect, useState } from 'react'
import { PageHeader } from '../layout/PageHeader'
import type { ChatExperienceSettings } from '../../models/types'
import {
  applyChatExperienceToDom,
  DEFAULT_CHAT_EXPERIENCE,
  getChatExperience,
  setChatExperience,
  setLayoutMode,
  STORYBOOK_DEFAULTS,
} from '../../services/chatExperienceSettings'

type Props = {
  onBack: () => void
}

export function ThemeStudioView({ onBack }: Props) {
  const [settings, setSettings] = useState<ChatExperienceSettings>(DEFAULT_CHAT_EXPERIENCE)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void getChatExperience().then((s) => {
      setSettings(s)
      applyChatExperienceToDom(s)
    })
  }, [])

  async function persist(next: ChatExperienceSettings) {
    setSettings(next)
    applyChatExperienceToDom(next)
    await setChatExperience(next)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-2">
      <PageHeader title="Appearance" onBack={onBack} />
      <p className="mb-4 text-sm text-[color:var(--color-muted)]">
        Classic vs Storybook chat layout. Colors stay Obsidian Gold for now.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={settings.layoutMode === 'classic' ? 'btn-tonal' : 'btn-outline'}
          onClick={() => void setLayoutMode('classic').then(persist)}
        >
          Classic
        </button>
        <button
          type="button"
          className={settings.layoutMode === 'storybook' ? 'btn-tonal' : 'btn-outline'}
          onClick={() => void setLayoutMode('storybook').then(persist)}
        >
          Storybook
        </button>
      </div>

      <label className="mb-4 block text-sm text-[color:var(--color-muted)]">
        Bubble opacity ({Math.round(settings.bubbleOpacity * 100)}%)
        <input
          className="mt-2 w-full"
          type="range"
          min={0.2}
          max={1}
          step={0.02}
          value={settings.bubbleOpacity}
          onChange={(e) => {
            const bubbleOpacity = Number(e.target.value)
            void persist({ ...settings, bubbleOpacity })
          }}
        />
      </label>

      <label className="mb-4 block text-sm text-[color:var(--color-muted)]">
        Corner radius ({settings.cornerRadius}px)
        <input
          className="mt-2 w-full"
          type="range"
          min={12}
          max={24}
          step={1}
          value={settings.cornerRadius}
          onChange={(e) => {
            const cornerRadius = Number(e.target.value)
            void persist({ ...settings, cornerRadius })
          }}
        />
      </label>

      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.speakerHeader}
          onChange={(e) => void persist({ ...settings, speakerHeader: e.target.checked })}
        />
        Speaker header above bubbles
      </label>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.sideHero}
          onChange={(e) => void persist({ ...settings, sideHero: e.target.checked })}
        />
        Side hero portrait (Storybook)
      </label>

      <button
        type="button"
        className="btn-ghost text-sm"
        onClick={() =>
          void persist(
            settings.layoutMode === 'storybook'
              ? { ...STORYBOOK_DEFAULTS }
              : { ...DEFAULT_CHAT_EXPERIENCE },
          )
        }
      >
        Reset layout defaults
      </button>
      {saved && <p className="mt-2 text-xs text-[color:var(--color-accent)]">Saved</p>}
    </div>
  )
}
