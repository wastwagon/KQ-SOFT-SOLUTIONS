import { Link2 } from 'lucide-react'
import { projectStepPath, type ProjectStepId } from '../../lib/projectRoutes'
import Button from '../ui/Button'
import { useToast } from '../ui/Toast'

type CopyProjectLinkButtonProps = {
  slug: string
  stepId?: ProjectStepId | string
}

export default function CopyProjectLinkButton({ slug, stepId }: CopyProjectLinkButtonProps) {
  const toast = useToast()

  async function copy() {
    const path = projectStepPath(slug, stepId)
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Project link copied', 'Share this URL with your team.')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={() => void copy()}
      className="gap-1.5 min-h-[44px] sm:min-h-[32px]"
    >
      <Link2 className="h-4 w-4 shrink-0" aria-hidden />
      Copy link
    </Button>
  )
}
