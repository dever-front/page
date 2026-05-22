import {
  lazy,
  Suspense,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react'

const ROUTE_EXPORT_NAMES = new Set([
  'component',
  'shellComponent',
  'pendingComponent',
  'errorComponent',
  'notFoundComponent',
])

export function lazyRouteComponent<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  fallback: ReactNode = null
) {
  const exportName = resolveRouteExportName(fallback)
  const fallbackNode = exportName ? null : fallback
  const LazyComponent = lazy(() => loadLazyRoute(loader, exportName))

  return function LazyRouteComponent(props: ComponentProps<T>) {
    return (
      <Suspense fallback={fallbackNode}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

async function loadLazyRoute<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T } | Record<string, unknown>>,
  exportName: string
): Promise<{ default: T }> {
  const mod = await loader()
  if (!exportName) {
    return mod as { default: T }
  }

  const component = mod[exportName]
  if (!component) {
    throw new Error(`lazyRouteComponent: missing "${exportName}" export`)
  }

  return { default: component as T }
}

function resolveRouteExportName(value: ReactNode) {
  if (typeof value !== 'string' || !ROUTE_EXPORT_NAMES.has(value)) {
    return ''
  }
  return value
}
