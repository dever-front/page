import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const ForbiddenError = lazyRouteComponent(() =>
  import('@/features/errors/forbidden').then((mod) => ({
    default: mod.ForbiddenError,
  }))
)

export const Route = createFileRoute('/(errors)/403')({
  component: ForbiddenError,
})
