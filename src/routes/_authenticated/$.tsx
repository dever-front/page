import { createFileRoute } from '@tanstack/react-router'
import { stringifyRouterSearch } from '@/lib/router-search'
import { stripRouterBasePath } from '@/lib/router-path'
import { Page } from '@/page/page'

export const Route = createFileRoute('/_authenticated/$')({
  component: DynamicNestedPage,
})

function DynamicNestedPage() {
  const { _splat } = Route.useParams()
  const search = Route.useSearch()
  const query = stringifyRouterSearch(search as Record<string, unknown>)

  const normalizedRoute = stripRouterBasePath(`/${_splat ?? ''}`).replace(/^\/+/, '')
  return <Page route={`/${normalizedRoute}${query}`} />
}
