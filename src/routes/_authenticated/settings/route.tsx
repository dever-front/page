import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const Settings = lazyRouteComponent(() =>
  import('@/features/settings').then((mod) => ({ default: mod.Settings }))
)

export const Route = createFileRoute('/_authenticated/settings')({
  component: Settings,
})
