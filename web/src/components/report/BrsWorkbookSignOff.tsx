import {
  BRS_SIGN_OFF_ROW_LABELS,
  buildBrsSignOffColumns,
  type BrsSignOffProjectInput,
} from '../../lib/brsSignOff'

interface BrsWorkbookSignOffProps {
  project?: BrsSignOffProjectInput | null
  className?: string
}

/**
 * GCAA-style workbook sign-off: dashed grid, bottom-right on the statement,
 * NAME/DATE pre-filled from workflow; SIGNATURE row left blank for wet sign.
 */
export default function BrsWorkbookSignOff({ project, className = '' }: BrsWorkbookSignOffProps) {
  const columns = buildBrsSignOffColumns(project)

  return (
    <div
      className={`mt-8 flex w-full justify-end print:mt-10 ${className}`.trim()}
      role="group"
      aria-label="BRS sign-off"
    >
      <table className="w-full max-w-[32rem] border-collapse text-xs text-slate-900 sm:max-w-[36rem] sm:text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="w-[4.25rem] border border-dashed border-slate-500 bg-white p-0 print:border-slate-700 sm:w-[4.75rem]"
              aria-hidden
            />
            {columns.map((col) => (
              <th
                key={col.header}
                scope="col"
                className="border border-dashed border-slate-500 bg-white px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-900 print:border-slate-700 sm:text-xs"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BRS_SIGN_OFF_ROW_LABELS.map((rowLabel) => (
            <tr key={rowLabel}>
              <th
                scope="row"
                className="border border-dashed border-slate-500 bg-white px-2 py-2.5 text-left text-[10px] font-bold tracking-wide text-slate-800 print:border-slate-700 sm:text-[11px]"
              >
                {rowLabel}
              </th>
              {columns.map((col) => {
                const value =
                  rowLabel === 'NAME' ? col.name : rowLabel === 'DATE' ? col.date : ''
                return (
                  <td
                    key={`${col.header}-${rowLabel}`}
                    className="border border-dashed border-slate-500 bg-white px-2 py-2.5 align-bottom print:border-slate-700"
                  >
                    <span
                      className={`block min-h-[1.35rem] leading-snug normal-case ${
                        value ? 'font-medium text-slate-900' : 'text-transparent print:text-transparent'
                      }`}
                      aria-hidden={!value}
                    >
                      {value || '\u00a0'}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
