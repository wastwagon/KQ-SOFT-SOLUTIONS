/**
 * KQ-SOFT mark — `public/kqsoft-wordmark.svg` and `public/kqsoft-icon.svg`.
 * App sidebar uses the icon with wordmark/org logo beside it; marketing/auth may use the wordmark alone.
 */
const ALT = 'KQ SOFT SOLUTIONS'

type BrandLogoProps = {
  /** Full horizontal wordmark (default) or square icon */
  variant?: 'wordmark' | 'icon'
  className?: string
}

export default function BrandLogo({ variant = 'wordmark', className = '' }: BrandLogoProps) {
  const src = variant === 'icon' ? '/kqsoft-icon.svg' : '/kqsoft-wordmark.svg'
  // Wordmark SVG viewBox 140×48; icon 64×64 — keeps tagline/centre alignment under the visible mark
  return (
    <img
      src={src}
      alt={ALT}
      className={className}
      width={variant === 'icon' ? 64 : 140}
      height={variant === 'icon' ? 64 : 48}
      decoding="async"
    />
  )
}
