import { createFileRoute } from '@tanstack/react-router'
import { errorRouteComponents } from '@/features/errors/lazy-components'

export const Route = createFileRoute('/(errors)/404')({
  component: errorRouteComponents['not-found'],
})
