import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const ErrorRouteContent = lazyRouteComponent(() =>
  import('./error-route-content').then((mod) => ({
    default: mod.ErrorRouteContent,
  }))
)

export const Route = createFileRoute('/_authenticated/errors/$error')({
  component: RouteComponent,
})

// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { error } = Route.useParams()
  return <ErrorRouteContent error={error} />
}
