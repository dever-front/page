import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { errorRouteComponents } from '@/features/errors/lazy-components'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'
import { RequestErrorDialog } from '@/components/request-error-dialog'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => (
    <>
      <NavigationProgress />
      <Outlet />
      <RequestErrorDialog />
      <Toaster />
    </>
  ),
  notFoundComponent: errorRouteComponents['not-found'],
  errorComponent: errorRouteComponents['internal-server-error'],
})
