import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Landmark } from 'lucide-react'
import Card from '../ui/Card'
import Button, { buttonClassName } from '../ui/Button'
import Input from '../ui/Input'
import { publicApi } from '../../lib/api'
import { useToast } from '../ui/Toast'
import { useAuth } from '../../store/auth'

/**
 * Bank connections / feeds tab — live Ghana open banking is not generally
 * available, so this surfaces the production import path and a waitlist.
 */
export default function SettingsConnectionsTab() {
  const toast = useToast()
  const org = useAuth((s) => s.org)
  const user = useAuth((s) => s.user)
  const [email, setEmail] = useState(user?.email || '')
  const [company, setCompany] = useState(org?.name || '')
  const [message, setMessage] = useState('')

  const joinMutation = useMutation({
    mutationFn: () =>
      publicApi.createLead({
        email,
        company: company || undefined,
        source: 'bank_feeds',
        message: message || 'Interested in live bank statement feeds.',
      }),
    onSuccess: (res) => {
      toast.success(
        res.duplicate ? 'Already on the waitlist' : 'Joined bank feeds waitlist',
        'We will contact you when live connections open for your banks.'
      )
      setMessage('')
    },
    onError: (err) => {
      toast.error('Could not join waitlist', err instanceof Error ? err.message : undefined)
    },
  })

  return (
    <div className="space-y-6">
      <Card
        title="Statement import (available now)"
        sublabel="Upload cash books and bank statements as CSV, Excel, or PDF. Ghana bank layouts (Ecobank, GCB, Absa, Stanbic, and more) are auto-detected during mapping."
      >
        <Link to="/projects" className={buttonClassName('outline', 'sm')}>
          Go to projects
        </Link>
      </Card>

      <Card
        title="Live bank feeds"
        sublabel="Direct bank connections for Ghana are limited today. Join the waitlist and we will prioritise your institution when aggregator or bank partnerships go live."
      >
        <form
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault()
            joinMutation.mutate()
          }}
        >
          <Input
            label="Work email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            label="Organisation"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
          />
          <div className="sm:col-span-2">
            <Input
              label="Banks you need (optional)"
              placeholder="e.g. Ecobank, GCB, Absa"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" isLoading={joinMutation.isPending}>
              <Landmark className="w-4 h-4 mr-1.5" />
              Join bank feeds waitlist
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
