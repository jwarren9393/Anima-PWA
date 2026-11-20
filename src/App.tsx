import { useEffect, useState } from 'react'
import type { AppRoute } from './navigation'
import { ApiSettingsView } from './components/views/ApiSettingsView'
import { BackupRestoreView } from './components/views/BackupRestoreView'
import { CharactersView } from './components/views/CharactersView'
import { ChatView } from './components/views/ChatView'
import { ComingSoonView } from './components/views/ComingSoonView'
import { CreationCenterView } from './components/views/CreationCenterView'
import { GroupChatSetupView } from './components/views/GroupChatSetupView'
import { HomeView } from './components/views/HomeView'
import { LorebooksView } from './components/views/LorebooksView'
import { PersonasView } from './components/views/PersonasView'
import { SettingsHubView } from './components/views/SettingsHubView'
import { ThemeStudioView } from './components/views/ThemeStudioView'
import { WorkshopChatView } from './components/views/WorkshopChatView'
import { PageHeader } from './components/layout/PageHeader'
import { createSoloChat } from './services/chatRepository'
import {
  applyChatExperienceToDom,
  getChatExperience,
} from './services/chatExperienceSettings'
import { getCharacter } from './services/libraryRepository'
import { getApiKey, getChatModelId } from './services/settingsStore'

export default function App() {
  const [route, setRoute] = useState<AppRoute>({ name: 'home' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [modelId, setModelId] = useState('')

  function bump() {
    setRefreshKey((k) => k + 1)
  }

  useEffect(() => {
    void getChatExperience().then(applyChatExperienceToDom)
  }, [])

  useEffect(() => {
    void (async () => {
      setHasApiKey(Boolean(await getApiKey()))
      setModelId(await getChatModelId())
    })()
  }, [refreshKey, route.name])

  function openChat(id: string) {
    setRoute({ name: 'chat', chatId: id })
    bump()
  }

  async function startChatFromCharacter(characterId: string) {
    const character = await getCharacter(characterId)
    if (!character) return
    const session = await createSoloChat({ character })
    openChat(session.id)
  }

  function backToSettings() {
    setRoute({ name: 'settings' })
  }

  if (route.name === 'chat') {
    return (
      <ChatView
        chatId={route.chatId}
        onClose={() => {
          setRoute({ name: 'home' })
          bump()
        }}
        onOpenApi={() => setRoute({ name: 'api' })}
        onOpenSettings={() => setRoute({ name: 'settings' })}
        onManageCast={() => setRoute({ name: 'groupSetup', chatId: route.chatId })}
        onBranched={(id) => openChat(id)}
      />
    )
  }

  if (route.name === 'groupSetup') {
    return (
      <GroupChatSetupView
        chatId={route.chatId}
        onBack={() => {
          if (route.chatId) {
            setRoute({ name: 'chat', chatId: route.chatId })
            bump()
          } else {
            setRoute({ name: 'home' })
          }
        }}
        onStarted={(id) => openChat(id)}
        onSaved={() => bump()}
      />
    )
  }

  if (route.name === 'workshop') {
    return (
      <WorkshopChatView
        workshopId={route.workshopId}
        onBack={() => setRoute({ name: 'creationCenter' })}
        onOpenApi={() => setRoute({ name: 'api' })}
      />
    )
  }

  return (
    <div className="min-h-full">
      {route.name === 'home' && (
        <HomeView
          refreshKey={refreshKey}
          onOpenChat={openChat}
          onOpenSettings={() => setRoute({ name: 'settings' })}
          onOpenGroupSetup={() => setRoute({ name: 'groupSetup' })}
          onOpenCreationCenter={() => setRoute({ name: 'creationCenter' })}
          onOpenWorkshop={(id) => setRoute({ name: 'workshop', workshopId: id })}
        />
      )}

      {route.name === 'settings' && (
        <SettingsHubView
          hasApiKey={hasApiKey}
          modelLabel={modelId}
          onBack={() => setRoute({ name: 'home' })}
          onOpen={(target, title) => {
            if (target === 'comingSoon') {
              setRoute({ name: 'comingSoon', title: title || 'Coming soon', back: 'settings' })
              return
            }
            if (target === 'api') setRoute({ name: 'api' })
            else if (target === 'characters') setRoute({ name: 'characters' })
            else if (target === 'personas') setRoute({ name: 'personas' })
            else if (target === 'lore') setRoute({ name: 'lore' })
            else if (target === 'backup') setRoute({ name: 'backup' })
            else if (target === 'creationCenter') setRoute({ name: 'creationCenter' })
            else if (target === 'appearance') setRoute({ name: 'appearance' })
          }}
        />
      )}

      {route.name === 'api' && (
        <div className="mx-auto w-full max-w-xl px-4 py-2">
          <PageHeader title="API & connection" onBack={backToSettings} />
          <ApiSettingsView onSaved={bump} />
        </div>
      )}

      {route.name === 'characters' && (
        <div className="mx-auto w-full max-w-4xl px-4 py-2">
          <PageHeader title="Characters" onBack={backToSettings} />
          <CharactersView onStartChat={(id) => void startChatFromCharacter(id)} />
        </div>
      )}

      {route.name === 'personas' && (
        <div className="mx-auto w-full max-w-4xl px-4 py-2">
          <PageHeader title="Personas" onBack={backToSettings} />
          <PersonasView onChanged={bump} />
        </div>
      )}

      {route.name === 'lore' && (
        <div className="mx-auto w-full max-w-4xl px-4 py-2">
          <PageHeader title="World Info & lore" onBack={backToSettings} />
          <LorebooksView />
        </div>
      )}

      {route.name === 'backup' && (
        <div className="mx-auto w-full max-w-xl px-4 py-2">
          <PageHeader title="Backup & restore" onBack={backToSettings} />
          <BackupRestoreView
            onRestored={() => {
              bump()
              setRoute({ name: 'home' })
            }}
          />
        </div>
      )}

      {route.name === 'creationCenter' && (
        <CreationCenterView
          refreshKey={refreshKey}
          onBack={() => setRoute({ name: 'settings' })}
          onOpenWorkshop={(id) => setRoute({ name: 'workshop', workshopId: id })}
        />
      )}

      {route.name === 'appearance' && (
        <ThemeStudioView onBack={backToSettings} />
      )}

      {route.name === 'comingSoon' && (
        <ComingSoonView
          title={route.title}
          onBack={() => {
            if (route.back === 'home') setRoute({ name: 'home' })
            else setRoute({ name: 'settings' })
          }}
        />
      )}
    </div>
  )
}
