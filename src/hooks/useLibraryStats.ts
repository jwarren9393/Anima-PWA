import { useCallback, useEffect, useState } from 'react'
import { getLibraryStats } from '../db/database'
import type { LibraryStats } from '../models/types'

const empty: LibraryStats = {
  characters: 0,
  personas: 0,
  lorebooks: 0,
  chats: 0,
  workshops: 0,
  media: 0,
}

export function useLibraryStats(refreshKey = 0) {
  const [stats, setStats] = useState<LibraryStats>(empty)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setStats(await getLibraryStats())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshKey])

  return { stats, loading, refresh }
}
