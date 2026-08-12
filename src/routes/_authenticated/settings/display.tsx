import { createFileRoute } from '@tanstack/react-router'
import { LazyJsonPageRoute } from '@/page/lazy-json-page-route'

export const Route = createFileRoute('/_authenticated/settings/display')({
  component: () => <LazyJsonPageRoute route='/settings-display' />,
})
