/**
 * In-app help for BRS terminology: cash book vs bank, uncredited lodgments vs unpresented cheques.
 * Used on Reconcile and Report pages.
 */
import { useState } from 'react'

const HELP_CONTENT = {
  cashBookVsBank: {
    title: 'Cash book vs bank statement',
    items: [
      { term: 'Cash book receipts', desc: 'Money received by the business (your records). Match these to bank credits.' },
      { term: 'Cash book payments', desc: 'Money paid out by the business (e.g. cheques issued). Match these to bank debits.' },
      { term: 'Bank credits', desc: 'Money lodged or credited to the account (bank’s record).' },
      { term: 'Bank debits', desc: 'Money withdrawn or debited from the account (e.g. cheques presented).' },
    ],
  },
  reportTerms: {
    title: 'Report terms',
    items: [
      { term: 'Uncredited lodgments', desc: 'Receipts you have recorded in the cash book but not yet shown as credited by the bank.' },
      { term: 'Unpresented cheques', desc: 'Cheques you have issued (cash book) but not yet presented to the bank.' },
      { term: 'Balance per cash book', desc: 'Reconciled balance at period end (bank closing + lodgments − unpresented cheques).' },
    ],
  },
  dataVsAttachments: {
    title: 'Source data vs supporting documents',
    items: [
      { term: 'Source data', desc: 'Cash book and bank statement uploads (Upload step). These are parsed and used for matching and the BRS.' },
      { term: 'Supporting documents', desc: 'Attachments such as approval scans or extra PDFs. They are listed on the report but not parsed for transactions.' },
    ],
  },
  unmatchedCauses: {
    title: 'Why are there unmatched items? Common causes & how to resolve',
    intro: 'Unmatched items are normal. Some are timing differences (they will match next period); others need a correction or a decision to leave as an exception on the BRS.',
    causes: [
      {
        name: 'Unpresented cheques',
        short: 'You issued a cheque (in cash book) but the bank has not yet debited it.',
        resolve: 'Do not try to match it to a bank debit yet. Leave it unmatched; the BRS will show it as a deduction from the bank balance. It will match when the cheque is presented.',
      },
      {
        name: 'Uncredited lodgments',
        short: 'You recorded a receipt and/or deposited cash/cheque but the bank has not yet credited your account.',
        resolve: 'Leave it unmatched. The BRS adds it to the bank balance. It will match when the bank credits the account (e.g. next statement).',
      },
      {
        name: 'Timing (different dates)',
        short: 'Same transaction appears in different periods (e.g. you recorded 31st, bank processed 1st).',
        resolve: 'Match it if you see the same amount and description on the other side in this or the next statement. Use Reconcile to link them.',
      },
      {
        name: 'Bank charges, interest, fees',
        short: 'Bank has debited charges or fees you have not yet entered in the cash book.',
        resolve: 'Enter the charge/fee in the cash book (payment), then re-upload or re-run so you can match it. Or leave as exception and note on BRS.',
      },
      {
        name: 'Direct credits / transfers in',
        short: 'Money paid into your account that you have not yet recorded.',
        resolve: 'Add the receipt to the cash book, then re-upload or re-run reconciliation and match it.',
      },
      {
        name: 'Standing orders / direct debits',
        short: 'Bank has debited a payment you have not recorded (or recorded differently).',
        resolve: 'Enter the payment in the cash book, then match. Or match if it’s already there under a different description (e.g. reference number).',
      },
      {
        name: 'Errors (yours or bank’s)',
        short: 'Wrong amount, duplicate entry, or missing entry on one side.',
        resolve: 'Correct the cash book (or raise with the bank if their error), then re-run. Match any remaining same-amount pairs.',
      },
    ],
  },
}

export default function BrsHelp({ variant = 'full' }: { variant?: 'reconcile' | 'report' | 'full' }) {
  const [open, setOpen] = useState(false)
  const showCashBook = variant === 'reconcile' || variant === 'full'
  const showReportTerms = variant === 'report' || variant === 'full'
  const showDataVsAttachments = variant === 'report' || variant === 'full'
  const showUnmatchedHints = variant === 'reconcile' || variant === 'full'

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 text-sm shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-gray-800 hover:bg-gray-100/80 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-colors"
        aria-expanded={open}
      >
        <span className="text-primary-600">What do these terms mean?</span>
        <span className="text-gray-400 text-xs">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t border-gray-200 mt-0 pt-3">
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
          {showUnmatchedHints && HELP_CONTENT.unmatchedCauses?.causes?.length > 0 && (
            <section>
              <h4 className="font-medium text-gray-800 mb-2">{HELP_CONTENT.unmatchedCauses.title}</h4>
              <p className="text-gray-600 mb-3">{HELP_CONTENT.unmatchedCauses.intro}</p>
              <ul className="space-y-3 text-gray-600">
                {HELP_CONTENT.unmatchedCauses.causes.map(({ name, short, resolve }) => (
                  <li key={name} className="pl-0">
                    <strong className="text-gray-800">{name}</strong>
                    <span className="block text-gray-600 mt-0.5">{short}</span>
                    <span className="block mt-1 text-primary-700 text-sm font-medium">→ Resolve: {resolve}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
