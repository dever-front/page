import { createFileRoute } from '@tanstack/react-router'
import { LazyJsonPageRoute } from '@/page/lazy-json-page-route'

export const Route = createFileRoute('/_authenticated/settings/notifications')({
  component: () => <LazyJsonPageRoute route='/settings-notifications' />,
})
