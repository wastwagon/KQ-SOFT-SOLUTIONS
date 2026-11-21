/**
 * In-app help for BRS terminology: cash book vs bank, uncredited lodgments vs unpresented cheques.
 * Used on Reconcile and Report pages.
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'

const HELP_CONTENT = {
  cashBookVsBank: {
    title: 'Cash book vs bank statement',
    items: [
      { term: 'Cash book receipts', desc: 'Money received by the business (your records). Match these to bank credits.' },
      { term: 'Cash book payments', desc: 'Money paid out by the business (e.g. cheques issued). Match these to bank debits.' },
      { term: 'Bank credits', desc: 'Money lodged or credited to the account (bank’s record).' },
          { term: 'Bank debits', desc: 'Money withdrawn or debited from the account (e.g. cheques presented).' },
          { term: 'Same amount, extra lines', desc: 'The same amount is on both sides, with more lines on one side. Match the lines that belong together. The rest stay open.' },
          { term: 'Split suggestions', desc: 'Different amounts that add up to one bank or cash-book line. This is separate from Match by counting.' },
    ],
  },
  reportTerms: {
    title: 'Report terms',
    items: [
      { term: 'Uncredited lodgments', desc: 'The BRS Add line: supporting-list items not yet credited by the bank (plus brought-forward lodgments). Cancelled reversals are netted off and are not the same as every unmatched receipt.' },
      { term: 'Unpresented cheques', desc: 'The BRS Less line: supporting-list items not yet presented (plus brought-forward cheques). Not the same as every unmatched payment.' },
      { term: 'Cash book balance at end of period', desc: 'The sum of the lines on the statement: bank closing + uncredited lodgments − unpresented cheques + bank-only debits − bank-only credits.' },
      { term: 'Cash book balance per cash book', desc: 'The closing balance from the cash book. It prints under the statement only when the two figures differ.' },
    ],
  },
  dataVsAttachments: {
    title: 'Source data vs supporting documents',
    items: [
      { term: 'Source data', desc: 'Cash book and bank statement uploads (Upload step). These are parsed and used for matching and the BRS.' },
      { term: 'Supporting documents', desc: 'Attachments such as approval scans or extra PDFs. They are listed on the report but not parsed for transactions.' },
    ],
  },
}

export default function BrsHelp({ variant = 'full' }: { variant?: 'reconcile' | 'report' | 'review' | 'full' }) {
  const [open, setOpen] = useState(false)
  const showCashBook = variant === 'reconcile' || variant === 'full'
  const showReportTerms = variant === 'report' || variant === 'full'
  const showDataVsAttachments = variant === 'report' || variant === 'full'

  return (
    <Card noPadding className="text-sm">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(!open)}
        className="w-full !justify-between px-4 py-3 h-auto rounded-xl font-semibold text-gray-800"
        aria-expanded={open}
      >
        <span className="text-primary-600">Terms</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </Button>
      {open && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border mt-0 pt-3">
          {showCashBook && (
            <section>
              <h4 className="font-medium text-gray-800 mb-2">{HELP_CONTENT.cashBookVsBank.title}</h4>
              <ul className="space-y-1.5 text-gray-600">
                {HELP_CONTENT.cashBookVsBank.items.map(({ term, desc }) => (
                  <li key={term}>
                    <strong className="text-gray-800">{term}:</strong> {desc}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {showReportTerms && (
            <section>
              <h4 className="font-medium text-gray-800 mb-2">{HELP_CONTENT.reportTerms.title}</h4>
              <ul className="space-y-1.5 text-gray-600">
                {HELP_CONTENT.reportTerms.items.map(({ term, desc }) => (
                  <li key={term}>
                    <strong className="text-gray-800">{term}:</strong> {desc}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {showDataVsAttachments && (
            <section>
              <h4 className="font-medium text-gray-800 mb-2">{HELP_CONTENT.dataVsAttachments.title}</h4>
              <ul className="space-y-1.5 text-gray-600">
                {HELP_CONTENT.dataVsAttachments.items.map(({ term, desc }) => (
                  <li key={term}>
                    <strong className="text-gray-800">{term}:</strong> {desc}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Card>
  )
}
