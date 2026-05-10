import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settings } from '../../lib/api'
import { BRAND_PRIMARY_HEX, BRAND_SECONDARY_HEX } from '../../lib/brandColors'
import { useToast } from '../ui/Toast'

export type BrandingRecord = {
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  letterheadAddress?: string
  reportTitle?: string
  footer?: string
  approvalThresholdAmount?: number | null
  organizationName?: string
}

/**
 * Local form state + mutations for the Settings ▸ Branding tab.  Keeps the
 * Settings page thin and avoids duplicating subscription usage queries — pass
 * feature flags from the parent after loading `/subscription/usage`.
 */
export function useBrandingSettings(features: Record<string, boolean>) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState(BRAND_PRIMARY_HEX)
  const [secondaryColor, setSecondaryColor] = useState(BRAND_SECONDARY_HEX)
  const [letterheadAddress, setLetterheadAddress] = useState('')
  const [reportTitle, setReportTitle] = useState('Bank Reconciliation Statement')
  const [footer, setFooter] = useState('')
  const [approvalThresholdAmount, setApprovalThresholdAmount] = useState('')
  const [logoLoadError, setLogoLoadError] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'branding'],
    queryFn: settings.getBranding,
  })

  const { data: platformDefaults } = useQuery({
    queryKey: ['settings', 'platform-defaults'],
    queryFn: settings.getPlatformDefaults,
  })

  const d = data as BrandingRecord | undefined

  useEffect(() => {
    if (d) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogoUrl(d.logoUrl ?? '')
      setLogoLoadError(false)
      setPrimaryColor(d.primaryColor ?? BRAND_PRIMARY_HEX)
      setSecondaryColor(d.secondaryColor ?? BRAND_SECONDARY_HEX)
      setLetterheadAddress(d.letterheadAddress ?? '')
      setReportTitle(d.reportTitle ?? 'Bank Reconciliation Statement')
      setFooter(d.footer ?? '')
      setApprovalThresholdAmount(
        d.approvalThresholdAmount != null && d.approvalThresholdAmount > 0
          ? String(d.approvalThresholdAmount)
          : ''
      )
    }
  }, [d])

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof settings.updateBranding>[0]) =>
      settings.updateBranding(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] })
      toast.success('Branding saved', 'Your changes are live across the app and reports.')
    },
    onError: (err) => {
      toast.error('Could not save branding', err instanceof Error ? err.message : undefined)
    },
  })

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => settings.uploadLogo(file),
    onSuccess: (uploadData) => {
      setLogoUrl(uploadData.logoUrl)
      setLogoLoadError(false)
      queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] })
      toast.success('Logo uploaded', 'Save branding to apply it to reports.')
    },
    onError: (err) => {
      toast.error('Logo upload failed', err instanceof Error ? err.message : undefined)
    },
  })

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      uploadLogoMutation.mutate(file)
      e.target.value = ''
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Parameters<typeof settings.updateBranding>[0] = {
      primaryColor: primaryColor || undefined,
      secondaryColor: secondaryColor || undefined,
      letterheadAddress: letterheadAddress.trim() || undefined,
      reportTitle: reportTitle.trim() || 'Bank Reconciliation Statement',
      footer: footer.trim() || undefined,
    }
    if (features.full_branding) payload.logoUrl = logoUrl.trim() || undefined
    if (features.threshold_approval) {
      const v = approvalThresholdAmount.trim()
      payload.approvalThresholdAmount = v === '' ? null : parseFloat(v) > 0 ? parseFloat(v) : null
    }
    updateMutation.mutate(payload)
  }

  const resetToPlatformDefaults = () => {
    if (!platformDefaults) return
    setReportTitle(platformDefaults.reportTitle ?? 'Bank Reconciliation Statement')
    setFooter(platformDefaults.footer ?? '')
    setPrimaryColor(platformDefaults.primaryColor ?? BRAND_PRIMARY_HEX)
    setSecondaryColor(platformDefaults.secondaryColor ?? BRAND_SECONDARY_HEX)
  }

  return {
    isLoading,
    data: d,
    platformDefaults,
    logoUrl,
    setLogoUrl,
    primaryColor,
    setPrimaryColor,
    secondaryColor,
    setSecondaryColor,
    letterheadAddress,
    setLetterheadAddress,
    reportTitle,
    setReportTitle,
    footer,
    setFooter,
    approvalThresholdAmount,
    setApprovalThresholdAmount,
    logoLoadError,
    setLogoLoadError,
    handleLogoUpload,
    handleSubmit,
    resetToPlatformDefaults,
    updateMutation,
    uploadLogoMutation,
  }
}
