import { useNavigate, useParams } from 'react-router-dom'
import Tabs from '../ui/Tabs'

export default function SettingsTabNav({
  showApiKeys,
  showBankRules,
}: {
  showApiKeys: boolean
  showBankRules: boolean
}) {
  const navigate = useNavigate()
  const { tab } = useParams<{ tab: string }>()
  const items = [
    { id: 'branding', label: 'Branding' },
    { id: 'billing', label: 'Billing' },
    { id: 'members', label: 'Members' },
    { id: 'connections', label: 'Connections' },
    ...(showApiKeys ? [{ id: 'api-keys', label: 'API keys' }] : []),
    ...(showBankRules ? [{ id: 'bank-rules', label: 'Bank rules' }] : []),
  ]
  const value = items.some((item) => item.id === tab) ? tab! : 'branding'

  return (
    <Tabs
      aria-label="Settings sections"
      value={value}
      onChange={(id) => navigate(`/settings/${id}`)}
      items={items}
    />
  )
}
