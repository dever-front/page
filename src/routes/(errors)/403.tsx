import { createFileRoute } from '@tanstack/react-router'
import { errorRouteComponents } from '@/features/errors/lazy-components'

export const Route = createFileRoute('/(errors)/403')({
  component: errorRouteComponents.forbidden,
})
