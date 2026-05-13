import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'
import { RequestErrorDialog } from '@/components/request-error-dialog'

const GeneralError = lazyRouteComponent(() =>
  import('@/features/errors/general-error').then((mod) => ({
    default: mod.GeneralError,
  }))
)
const NotFoundError = lazyRouteComponent(() =>
  import('@/features/errors/not-found-error').then((mod) => ({
    default: mod.NotFoundError,
  }))
)

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
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
