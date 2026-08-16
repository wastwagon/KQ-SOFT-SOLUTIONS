import { Link2 } from 'lucide-react'

/** Compact marker for a row that has a suggested match. Replaces the 🔗 emoji. */
export default function SuggestedMatchMark({ title }: { title?: string }) {
  return (
    <span title={title} className="ml-1 inline-block shrink-0 align-text-bottom">
      <Link2
        className="h-3.5 w-3.5 text-primary-600"
        aria-label="Suggested match"
      />
    </span>
  )
}
