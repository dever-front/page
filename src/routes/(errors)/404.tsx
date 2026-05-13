import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const NotFoundError = lazyRouteComponent(() =>
  import('@/features/errors/not-found-error').then((mod) => ({
    default: mod.NotFoundError,
  }))
)

export const Route = createFileRoute('/(errors)/404')({
  component: NotFoundError,
})
