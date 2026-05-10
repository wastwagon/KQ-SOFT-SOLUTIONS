import { NavLink } from 'react-router-dom'

export default function SettingsTabNav({
  showApiKeys,
  showBankRules,
}: {
  showApiKeys: boolean
  showBankRules: boolean
}) {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
      isActive
        ? 'text-primary-700 border-primary-600 bg-white'
        : 'text-gray-600 border-transparent hover:text-primary-600 hover:border-gray-300'
    }`

  return (
    <nav className="flex gap-0.5 mb-6 border-b border-gray-200" aria-label="Settings sections">
      <NavLink to="/settings/branding" end className={tabClass}>
        Branding
      </NavLink>
      <NavLink to="/settings/billing" className={tabClass}>
        Billing
      </NavLink>
      <NavLink to="/settings/members" className={tabClass}>
        Members
      </NavLink>
      {showApiKeys && (
        <NavLink to="/settings/api-keys" className={tabClass}>
          API keys
        </NavLink>
      )}
      {showBankRules && (
        <NavLink to="/settings/bank-rules" className={tabClass}>
          Bank rules
        </NavLink>
      )}
    </nav>
  )
}
