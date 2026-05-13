import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const MaintenanceError = lazyRouteComponent(() =>
  import('@/features/errors/maintenance-error').then((mod) => ({
    default: mod.MaintenanceError,
  }))
)

export const Route = createFileRoute('/(errors)/503')({
  component: MaintenanceError,
})
