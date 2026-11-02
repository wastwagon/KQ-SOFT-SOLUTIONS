import type { ImgHTMLAttributes } from 'react'

type MarketingPhotoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** Path to JPEG under `/marketing/…` */
  src: string
  /** Intrinsic size for CLS (defaults match most 1920×1280 marketing JPEGs). */
  width?: number
  height?: number
}

/** JPEG + WebP `<picture>` for marketing assets (WebP generated at build time). */
export default function MarketingPhoto({
  src,
  alt,
  width = 1920,
  height = 1280,
  ...rest
}: MarketingPhotoProps) {
  const webp = src.replace(/\.jpe?g$/i, '.webp')
  return (
    <picture>
      <source srcSet={webp} type="image/webp" />
      <img src={src} alt={alt ?? ''} width={width} height={height} {...rest} />
    </picture>
  )
}
