export type AppRoute =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'api' }
  | { name: 'characters' }
  | { name: 'personas' }
  | { name: 'lore' }
  | { name: 'backup' }
  | { name: 'chat'; chatId: string }
  | { name: 'groupSetup'; chatId?: string }
  | { name: 'creationCenter' }
  | { name: 'workshop'; workshopId: string }
  | { name: 'appearance' }
  | { name: 'comingSoon'; title: string; back?: 'settings' | 'home' }

export function routeTitle(route: AppRoute): string {
  switch (route.name) {
    case 'home':
      return 'Anima'
    case 'settings':
      return 'Settings'
    case 'api':
      return 'API & connection'
    case 'characters':
      return 'Characters'
    case 'personas':
      return 'Personas'
    case 'lore':
      return 'World Info & lore'
    case 'backup':
      return 'Backup & restore'
    case 'chat':
      return 'Chat'
    case 'groupSetup':
      return route.chatId ? 'Manage cast' : 'New group chat'
    case 'creationCenter':
      return 'Creation Center'
    case 'workshop':
      return 'Workshop'
    case 'appearance':
      return 'Appearance'
    case 'comingSoon':
      return route.title
  }
}
