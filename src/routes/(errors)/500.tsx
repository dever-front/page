import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const GeneralError = lazyRouteComponent(() =>
  import('@/features/errors/general-error').then((mod) => ({
    default: mod.GeneralError,
  }))
)

export const Route = createFileRoute('/(errors)/500')({
  component: GeneralError,
})
