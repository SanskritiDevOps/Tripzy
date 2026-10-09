import { Compass } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/States'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <EmptyState
        icon={Compass}
        title="Looks like you wandered off the map"
        description="The page you’re looking for doesn’t exist."
        action={<Button to="/">Back to Tripzy</Button>}
      />
    </div>
  )
}
