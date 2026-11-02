import { Suspense, type ReactNode } from 'react'
import PageLoader from '../PageLoader'

/** Full-screen fallback for public/auth lazy routes (no app shell). */
export function PublicRouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}
