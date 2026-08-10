import { createFileRoute } from '@tanstack/react-router'
import { JsonPageRoute } from '@/page/json-page-route'

export const Route = createFileRoute('/_authenticated/settings/display')({
  component: () => <JsonPageRoute route='/settings-display' />,
})
