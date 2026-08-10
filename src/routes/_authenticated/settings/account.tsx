import { createFileRoute } from '@tanstack/react-router'
import { JsonPageRoute } from '@/page/json-page-route'

export const Route = createFileRoute('/_authenticated/settings/account')({
  component: () => <JsonPageRoute route='/settings-account' />,
})
