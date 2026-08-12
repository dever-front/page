import { createFileRoute } from '@tanstack/react-router'
import { LazyJsonPageRoute } from '@/page/lazy-json-page-route'
import { stripRouterBasePath } from '@/lib/router-path'
import { stringifyRouterSearch } from '@/lib/router-search'

export const Route = createFileRoute('/_authenticated/$')({
  component: DynamicNestedPage,
})

function DynamicNestedPage() {
  const { _splat } = Route.useParams()
  const search = Route.useSearch()
  const query = stringifyRouterSearch(search as Record<string, unknown>)

  const normalizedRoute = stripRouterBasePath(`/${_splat ?? ''}`).replace(
    /^\/+/,
    ''
  )
  return <LazyJsonPageRoute route={`/${normalizedRoute}${query}`} />
}
