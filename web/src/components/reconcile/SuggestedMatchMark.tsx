import { Link2 } from 'lucide-react'

/** Compact marker for a row that has a suggested match. Replaces the 🔗 emoji. */
export default function SuggestedMatchMark({ title }: { title?: string }) {
  return (
    <Link2
      className="ml-1 inline-block h-3.5 w-3.5 shrink-0 align-text-bottom text-primary-600"
      aria-label="Suggested match"
      title={title}
    />
  )
}
