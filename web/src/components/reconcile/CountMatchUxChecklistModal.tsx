import { useMemo, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import {
  clearCountMatchUxSignoff,
  saveCountMatchUxSignoff,
  type CountMatchUxSignoff,
} from '../../lib/countMatchUxSignoff'

const DESKTOP_ITEMS = [
  'Summary badges (cash book only, bank only, extra lines, batch cancel) show counts you expect.',
  'Same count → extra lines → one side only: list rows are easy to find; the active list is obvious.',
  'Excel/PDF export works from header buttons.',
] as const

const MOBILE_ITEMS = [
  'Summary badges still visible (not hidden in a menu).',
  'Choose matching list opens; Cancel / extra lines / one-side lists are clear.',
  'Export menu downloads Excel or PDF.',
  'After selecting lines, Confirm match bar is reachable (not covered by bottom nav).',
] as const

const SUGGESTED_ITEMS = [
  'Auto-match all remains visible (not buried).',
  'More bulk is acceptable for 90%+ / pattern matches.',
] as const

type Props = {
  open: boolean
  onClose: () => void
  projectId: string
  projectLabel?: string
  existing?: CountMatchUxSignoff | null
  onSaved: (signoff: CountMatchUxSignoff | null) => void
}

function CheckRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex gap-3 text-sm text-slate-700 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-border text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

export default function CountMatchUxChecklistModal({
  open,
  onClose,
  projectId,
  projectLabel,
  existing,
  onSaved,
}: Props) {
  const [tester, setTester] = useState('')
  const [desktop, setDesktop] = useState<boolean[]>(() => DESKTOP_ITEMS.map(() => false))
  const [mobile, setMobile] = useState<boolean[]>(() => MOBILE_ITEMS.map(() => false))
  const [suggested, setSuggested] = useState<boolean[]>(() => SUGGESTED_ITEMS.map(() => false))
  const [failNotes, setFailNotes] = useState('')

  const allChecked = useMemo(
    () =>
      desktop.every(Boolean) &&
      mobile.every(Boolean) &&
      suggested.every(Boolean),
    [desktop, mobile, suggested],
  )

  function persist(result: 'pass' | 'fail', notes?: string) {
    const signoff: CountMatchUxSignoff = {
      projectId,
      result,
      tester: tester.trim() || 'Anonymous',
      date: new Date().toISOString(),
      notes: notes?.trim() || undefined,
    }
    saveCountMatchUxSignoff(signoff)
    onSaved(signoff)
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Match by counting — preparer check"
      onClose={onClose}
      footer={
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-between w-full">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2 justify-end">
            {existing && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  clearCountMatchUxSignoff(projectId)
                  onSaved(null)
                  onClose()
                }}
              >
                Clear sign-off
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => persist('fail', failNotes)}
            >
              Record fail
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!allChecked}
              onClick={() => persist('pass')}
            >
              Record pass
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 max-h-[min(60vh,28rem)] overflow-y-auto pr-1">
        <p className="text-sm text-slate-600">
          ~5 minutes on this project{projectLabel ? ` (${projectLabel})` : ''} on desktop and phone before we hide
          count-match badges or primary actions. Repo script:{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">docs/RECONCILE_COUNT_MATCH_UX_TEST.md</code>
        </p>

        <Input
          label="Tester name (optional)"
          value={tester}
          onChange={(e) => setTester(e.target.value)}
          placeholder="Preparer name"
          autoComplete="name"
        />

        <section className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Desktop (lg+)</h4>
          {DESKTOP_ITEMS.map((label, i) => (
            <CheckRow
              key={label}
              id={`cm-ux-d-${i}`}
              label={label}
              checked={desktop[i]}
              onChange={(v) =>
                setDesktop((prev) => {
                  const next = [...prev]
                  next[i] = v
                  return next
                })
              }
            />
          ))}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone / narrow (&lt; lg)</h4>
          {MOBILE_ITEMS.map((label, i) => (
            <CheckRow
              key={label}
              id={`cm-ux-m-${i}`}
              label={label}
              checked={mobile[i]}
              onChange={(v) =>
                setMobile((prev) => {
                  const next = [...prev]
                  next[i] = v
                  return next
                })
              }
            />
          ))}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Suggested matches</h4>
          {SUGGESTED_ITEMS.map((label, i) => (
            <CheckRow
              key={label}
              id={`cm-ux-s-${i}`}
              label={label}
              checked={suggested[i]}
              onChange={(v) =>
                setSuggested((prev) => {
                  const next = [...prev]
                  next[i] = v
                  return next
                })
              }
            />
          ))}
        </section>

        <Input
          label="If anything failed — notes for engineering"
          value={failNotes}
          onChange={(e) => setFailNotes(e.target.value)}
          placeholder="Screen size, list name, what was blocked…"
        />

        {!allChecked && (
          <p className="text-xs text-slate-500 flex items-start gap-2">
            <ClipboardCheck className="w-4 h-4 shrink-0 mt-0.5" />
            Check every item to enable <strong className="font-semibold">Record pass</strong>, or use{' '}
            <strong className="font-semibold">Record fail</strong> anytime.
          </p>
        )}
      </div>
    </Modal>
  )
}
