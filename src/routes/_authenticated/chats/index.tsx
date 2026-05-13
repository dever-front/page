import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const Chats = lazyRouteComponent(() =>
  import('@/features/chats').then((mod) => ({ default: mod.Chats }))
)

export const Route = createFileRoute('/_authenticated/chats/')({
  component: Chats,
})
