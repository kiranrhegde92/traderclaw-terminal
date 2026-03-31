import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isConnected:   boolean
  isOfflineMode: boolean
  clientId:      string | null
  profile:       { name: string; email: string } | null
  jwtToken:      string | null
  feedToken:     string | null
  expiresAt:     number | null

  setSession: (data: {
    jwtToken:  string
    feedToken: string
    clientId:  string
    profile:   { name: string; email: string }
  }) => void
  setOfflineMode: () => void
  clearSession:   () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isConnected:   false,
      isOfflineMode: false,
      clientId:      null,
      profile:       null,
      jwtToken:      null,
      feedToken:     null,
      expiresAt:     null,

      setSession: (data) => set({
        isConnected:   true,
        isOfflineMode: false,
        clientId:      data.clientId,
        profile:       data.profile,
        jwtToken:      data.jwtToken,
        feedToken:     data.feedToken,
        expiresAt:     Date.now() + 8 * 60 * 60 * 1000, // 8h
      }),

      setOfflineMode: () => set({
        isOfflineMode: true,
        isConnected:   false,
      }),

      clearSession: () => set({
        isConnected:   false,
        isOfflineMode: false,
        clientId:      null,
        profile:       null,
        jwtToken:      null,
        feedToken:     null,
        expiresAt:     null,
      }),
    }),
    { name: 'openclaw-auth' }
  )
)
