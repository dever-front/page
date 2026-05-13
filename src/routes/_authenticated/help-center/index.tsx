import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const ComingSoon = lazyRouteComponent(() =>
  import('@/components/coming-soon').then((mod) => ({
    default: mod.ComingSoon,
  }))
)

export const Route = createFileRoute('/_authenticated/help-center/')({
  component: ComingSoon,
})
