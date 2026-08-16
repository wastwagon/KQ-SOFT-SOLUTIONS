import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Card from '../ui/Card'
import Alert from '../ui/Alert'
import Button, { buttonClassName } from '../ui/Button'
import Input from '../ui/Input'
import Textarea from '../ui/Textarea'
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
    <Card
      title="Report Branding"
      sublabel="Customise your Bank Reconciliation Statement reports with your logo, colours, and letterhead."
    >
      {b.platformDefaultsLoadFailed && (
        <Alert
          tone="warning"
          title="Platform default text could not be loaded"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['settings', 'platform-defaults'] })}
          className="mb-4 max-w-2xl"
        />
      )}
      <form onSubmit={b.handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Logo</label>
          {!features.full_branding && (
            <Alert tone="warning" title="Logo requires Standard plan or higher" className="mb-2">
              The Basic plan can customise colours and text only —{' '}
              <Link to="/settings/billing" className="font-semibold underline hover:no-underline">
                upgrade your subscription
              </Link>{' '}
              to add your logo to PDF letterheads.
            </Alert>
          )}
          {features.full_branding && (
            <>
              <div className="flex flex-wrap gap-4 items-start">
                {b.logoUrl && (
                  <div className="flex-shrink-0 min-w-[80px] min-h-[60px] max-w-[240px] max-h-[120px] rounded-xl border border-border overflow-hidden bg-gray-50 flex items-center justify-center p-2">
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
                  <label
                    className={`${buttonClassName('outline', 'md')} cursor-pointer`}
                    aria-busy={b.uploadLogoMutation.isPending || undefined}
                  >
                    {b.uploadLogoMutation.isPending && (
                      <svg className="animate-spin mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    Upload logo
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
              <div className="mt-2">
                <Input
                  type="url"
                  value={b.logoUrl}
                  onChange={(e) => b.setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  hint="Enter a public URL instead of uploading. Leave blank to hide logo."
                />
              </div>
              {b.uploadLogoMutation.error && (
                <Alert tone="error" title="Logo upload failed" className="mt-2">
                  {(b.uploadLogoMutation.error as Error).message}
                </Alert>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Primary colour</p>
            <div className="flex gap-2">
              <input
                type="color"
                value={b.primaryColor}
                onChange={(e) => b.setPrimaryColor(e.target.value)}
                aria-label="Primary colour"
                className="h-11 w-14 shrink-0 rounded-xl cursor-pointer border border-gray-200"
              />
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  value={b.primaryColor}
                  onChange={(e) => b.setPrimaryColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Secondary colour</p>
            <div className="flex gap-2">
              <input
                type="color"
                value={b.secondaryColor}
                onChange={(e) => b.setSecondaryColor(e.target.value)}
                aria-label="Secondary colour"
                className="h-11 w-14 shrink-0 rounded-xl cursor-pointer border border-gray-200"
              />
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  value={b.secondaryColor}
                  onChange={(e) => b.setSecondaryColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </div>
        <Textarea
          label="Letterhead / Address"
          value={b.letterheadAddress}
          onChange={(e) => b.setLetterheadAddress(e.target.value)}
          placeholder="Suite 100, City, Country"
          rows={2}
        />
        <Input
          type="text"
          label="Report title"
          value={b.reportTitle}
          onChange={(e) => b.setReportTitle(e.target.value)}
          placeholder="Bank Reconciliation Statement"
        />
        <Input
          type="text"
          label="Footer"
          value={b.footer}
          onChange={(e) => b.setFooter(e.target.value)}
          placeholder="Prepared by KQ SOFT SOLUTIONS"
        />
        {features.roll_forward && (
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={b.ghanaBrsWorkbookNettingDefault}
                onChange={(e) => b.setGhanaBrsWorkbookNettingDefault(e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-700">
                  Ghana BRS workbook netting (default on)
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  For Ecobank-style BRS, net unpresented cheque groups 2–3 by default on new reports and
                  reconcile sessions. Users can still turn it off per project in the report view.
                </span>
              </span>
            </label>
          </div>
        )}
        {features.threshold_approval && (
          <Input
            type="number"
            min={0}
            step={100}
            label="Approval threshold (GH₵)"
            value={b.approvalThresholdAmount}
            onChange={(e) => b.setApprovalThresholdAmount(e.target.value)}
            placeholder="Leave blank for no limit"
            className="max-w-[200px]"
            hint="Projects with discrepancy above this amount require admin approval (reviewers cannot approve)."
          />
        )}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {canEditBranding(role) && (
            <Button type="submit" isLoading={b.updateMutation.isPending}>
              Save branding
            </Button>
          )}
          {canEditBranding(role) && b.platformDefaults && (
            <Button type="button" variant="outline" onClick={b.resetToPlatformDefaults}>
              Reset to platform default
            </Button>
          )}
        </div>
      </form>
      {d?.organizationName && (
        <p className="text-sm text-gray-500 mt-4">
          Fallback company name on reports: <strong>{d.organizationName}</strong> (organisation name).
          When a project has a <em>business name as on bank statement</em>, that name is used on the
          printed BRS instead.
        </p>
      )}
    </Card>
  )
}
