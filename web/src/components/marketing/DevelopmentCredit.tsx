type DevelopmentCreditTone = 'light' | 'dark' | 'muted'

const OCEANCYBER_URL = 'https://oceancyber.net/'

const toneClasses: Record<DevelopmentCreditTone, { wrap: string; link: string; sep: string }> = {
  dark: {
    wrap: 'text-white/75',
    link: 'text-white/90 hover:text-primary-200 underline decoration-white/25 underline-offset-[3px] hover:decoration-primary-300/60 transition-colors',
    sep: 'text-white/40',
  },
  light: {
    wrap: 'text-gray-500',
    link: 'text-gray-700 hover:text-primary-700 font-medium underline decoration-gray-300 underline-offset-[3px] hover:decoration-primary-400/70 transition-colors',
    sep: 'text-gray-300',
  },
  muted: {
    wrap: 'text-gray-400',
    link: 'text-gray-600 hover:text-primary-600 font-medium underline decoration-gray-200 underline-offset-[3px] hover:decoration-primary-300/70 transition-colors',
    sep: 'text-gray-300',
  },
}

type DevelopmentCreditProps = {
  tone?: DevelopmentCreditTone
  className?: string
  /** Center on marketing pages; left-align in app-adjacent shells */
  align?: 'center' | 'start'
}

/**
 * Agency attribution — visible, crawlable backlink for OceanCyber.
 */
export default function DevelopmentCredit({
  tone = 'light',
  className = '',
  align = 'center',
}: DevelopmentCreditProps) {
  const t = toneClasses[tone]
  return (
    <p
      className={`text-[11px] sm:text-xs leading-relaxed ${t.wrap} ${
        align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
    >
      <span className="text-inherit">Designed &amp; developed by </span>
      <a
        href={OCEANCYBER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={t.link}
        title="OceanCyber — Website & Mobile App Development"
      >
        OceanCyber
      </a>
      <span className={t.sep} aria-hidden> · </span>
      <span className="text-inherit">Website &amp; Mobile App Development</span>
    </p>
  )
}
