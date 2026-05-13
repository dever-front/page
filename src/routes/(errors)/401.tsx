import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const UnauthorisedError = lazyRouteComponent(() =>
  import('@/features/errors/unauthorized-error').then((mod) => ({
    default: mod.UnauthorisedError,
  }))
)

export const Route = createFileRoute('/(errors)/401')({
  component: UnauthorisedError,
})
