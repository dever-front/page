import {
  lazy,
  Suspense,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react'

export function lazyRouteComponent<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  fallback: ReactNode = null
) {
  const LazyComponent = lazy(loader)

  return function LazyRouteComponent(props: ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}
