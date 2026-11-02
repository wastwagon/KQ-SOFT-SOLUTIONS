import type { ReactNode } from 'react'

export type WorkspaceBannerInput = {
  impersonating: boolean
  impersonationNote?: string
  showSubscriptionStrip: boolean
  subscriptionStrip: ReactNode
  showAdminBypassStrip: boolean
  adminBypassStrip: ReactNode
  showUsageFailureStrip: boolean
  usageFailureStrip: ReactNode
  showBrandingFailureStrip: boolean
  brandingFailureStrip: ReactNode
  impersonationBanner: ReactNode
}

/**
 * One layout banner at a time (severity-ranked). Impersonation always wins.
 */
export function pickWorkspaceLayoutBanner(input: WorkspaceBannerInput): ReactNode {
  if (input.impersonating) {
    return input.impersonationBanner
  }
  if (input.showSubscriptionStrip) return input.subscriptionStrip
  if (input.showAdminBypassStrip) return input.adminBypassStrip
  if (input.showUsageFailureStrip) return input.usageFailureStrip
  if (input.showBrandingFailureStrip) return input.brandingFailureStrip
  return null
}
