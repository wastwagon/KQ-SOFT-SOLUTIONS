import { useQueryClient } from '@tanstack/react-query'
import Card from '../ui/Card'
import { getLogoDisplayUrl } from '../../lib/api'
import { canEditBranding } from '../../lib/permissions'
import type { OrgRole } from '../../lib/permissions'
import { useBrandingSettings } from './useBrandingSettings'

interface SettingsBrandingTabProps {
  role: OrgRole | string | null
  features: Record<string, boolean>
  branding: ReturnType<typeof useBrandingSettings>
}

export default function SettingsBrandingTab({ role, features, branding: b }: SettingsBrandingTabProps) {
  const queryClient = useQueryClient()

  const d = b.data

  return (
    <Card className="rounded-xl border-l-4 border-l-primary-500 border-gray-200 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">Report Branding</h2>
      {b.platformDefaultsLoadFailed && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 mb-4 max-w-2xl">
          <span>Platform default text could not be loaded. </span>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['settings', 'platform-defaults'] })}
            className="font-semibold text-amber-900 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
      <p className="text-sm text-gray-600 mb-6">
        Customise your Bank Reconciliation Statement reports with your logo, colours, and letterhead.
      </p>
      <form onSubmit={b.handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Logo</label>
          {!features.full_branding && (
            <p className="text-sm text-amber-600 mb-2">
              Logo on reports requires Premium plan or higher. Basic and Standard plans can customise
              colours and text.
            </p>
          )}
          {features.full_branding && (
            <>
              <div className="flex flex-wrap gap-4 items-start">
                {b.logoUrl && (
                  <div className="flex-shrink-0 min-w-[80px] min-h-[60px] max-w-[240px] max-h-[120px] rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center p-2">
                    {b.logoLoadError ? (
                      <p className="text-xs text-gray-500 text-center">Logo could not be loaded</p>
                    ) : (
                      <img
                        src={getLogoDisplayUrl(b.logoUrl)}
                        alt="Logo"
                        className="max-w-full max-h-full w-auto h-auto object-contain"
                        onError={() => b.setLogoLoadError(true)}
                      />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <label className="inline-flex items-center justify-center px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm cursor-pointer transition-colors">
                    {b.uploadLogoMutation.isPending ? 'Uploading...' : 'Upload logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="sr-only"
                      onChange={b.handleLogoUpload}
                      disabled={b.uploadLogoMutation.isPending}
                    />
                  </label>
                  <p className="text-xs text-gray-500">Upload PNG or JPG (max 2MB). Or paste a URL below.</p>
                </div>
              </div>
              <input
                type="url"
                value={b.logoUrl}
                onChange={(e) => b.setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="mt-2 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a public URL instead of uploading. Leave blank to hide logo.
              </p>
              {b.uploadLogoMutation.error && (
                <p className="mt-1 text-sm text-red-600">
                  {(b.uploadLogoMutation.error as Error).message}
                </p>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Primary colour</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={b.primaryColor}
                onChange={(e) => b.setPrimaryColor(e.target.value)}
                className="h-10 w-14 rounded-lg cursor-pointer border border-gray-200 shadow-sm"
              />
              <input
                type="text"
                value={b.primaryColor}
                onChange={(e) => b.setPrimaryColor(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Secondary colour</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={b.secondaryColor}
                onChange={(e) => b.setSecondaryColor(e.target.value)}
                className="h-10 w-14 rounded-lg cursor-pointer border border-gray-200 shadow-sm"
              />
              <input
                type="text"
                value={b.secondaryColor}
                onChange={(e) => b.setSecondaryColor(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Letterhead / Address</label>
          <textarea
            value={b.letterheadAddress}
            onChange={(e) => b.setLetterheadAddress(e.target.value)}
            placeholder="Suite 100, City, Country"
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Report title</label>
          <input
            type="text"
            value={b.reportTitle}
            onChange={(e) => b.setReportTitle(e.target.value)}
            placeholder="Bank Reconciliation Statement"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Footer</label>
          <input
            type="text"
            value={b.footer}
            onChange={(e) => b.setFooter(e.target.value)}
            placeholder="Prepared by KQ SOFT SOLUTIONS"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        {features.threshold_approval && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Approval threshold (GH₵)
            </label>
            <input
              type="number"
              min={0}
              step={100}
              value={b.approvalThresholdAmount}
              onChange={(e) => b.setApprovalThresholdAmount(e.target.value)}
              placeholder="Leave blank for no limit"
              className="w-full max-w-[200px] px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Projects with discrepancy above this amount require admin approval (reviewers cannot
              approve).
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {canEditBranding(role) && (
            <button
              type="submit"
              disabled={b.updateMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {b.updateMutation.isPending ? 'Saving...' : 'Save branding'}
            </button>
          )}
          {canEditBranding(role) && b.platformDefaults && (
            <button
              type="button"
              onClick={b.resetToPlatformDefaults}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
            >
              Reset to platform default
            </button>
          )}
        </div>
      </form>
      {d?.organizationName && (
        <p className="text-sm text-gray-500 mt-4">
          Company name in reports: <strong>{d.organizationName}</strong> (set when your organisation was
          created)
        </p>
      )}
    </Card>
  )
}
