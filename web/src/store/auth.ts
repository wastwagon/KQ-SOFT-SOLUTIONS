import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name?: string
}

interface Org {
  id: string
  name: string
}

interface AuthState {
  user: User | null
  org: Org | null
  role: string | null
  token: string | null
  isPlatformAdmin: boolean
  setAuth: (user: User, org: Org, token: string, role?: string, isPlatformAdmin?: boolean) => void
  refreshSession: (data: { user: User; org: Org; role?: string | null; isPlatformAdmin: boolean }) => void
  logout: () => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
}

// Single-source-of-truth token storage:
// The zustand `persist` middleware already mirrors the entire auth state to
// `localStorage` under the `brs-auth` key. We no longer maintain a separate
// `brs_token` mirror; reads go through `useAuth.getState().token` and the
// store handles persistence. A one-shot migration below upgrades existing
// users from the previous dual-storage layout.
function migrateLegacyToken(): string | null {
  try {
    const legacy = localStorage.getItem('brs_token')
    if (legacy) {
      localStorage.removeItem('brs_token')
      return legacy
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through.
  }
  return null
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      org: null,
      role: null,
      token: null,
      isPlatformAdmin: false,
      setAuth: (user, org, token, role, isPlatformAdmin) => {
        set({ user, org, token, role: role ?? null, isPlatformAdmin: !!isPlatformAdmin })
      },
      refreshSession: (data) => {
        set({
          user: data.user,
          org: data.org,
          role: data.role ?? null,
          isPlatformAdmin: !!data.isPlatformAdmin,
        })
      },
      logout: () => {
        set({ user: null, org: null, role: null, token: null, isPlatformAdmin: false })
      },
      isAuthenticated: () => !!get().token,
      isAdmin: () => get().role === 'admin',
    }),
    {
      name: 'brs-auth',
      onRehydrateStorage: () => (state) => {
        // If the persisted store has no token but the legacy `brs_token`
        // key still exists, copy it across so the user stays logged in.
        if (state && !state.token) {
          const legacy = migrateLegacyToken()
          if (legacy) {
            state.token = legacy
          }
        } else {
          // We have a token in the store — drop any stale legacy mirror.
          migrateLegacyToken()
        }
      },
    }
  )
)
