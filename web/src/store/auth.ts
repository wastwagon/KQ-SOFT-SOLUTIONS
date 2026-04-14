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

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      org: null,
      role: null,
      token: null,
      isPlatformAdmin: false,
      setAuth: (user, org, token, role, isPlatformAdmin) => {
        localStorage.setItem('brs_token', token)
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
        localStorage.removeItem('brs_token')
        set({ user: null, org: null, role: null, token: null, isPlatformAdmin: false })
      },
      isAuthenticated: () => !!get().token,
      isAdmin: () => get().role === 'admin',
    }),
    { name: 'brs-auth' }
  )
)
