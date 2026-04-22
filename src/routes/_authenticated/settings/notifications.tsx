import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/page/page'

export const Route = createFileRoute('/_authenticated/settings/notifications')({
  component: () => <Page route="/settings-notifications" />,
})
