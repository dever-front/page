import { lazy, Suspense, type ComponentProps, type ComponentType } from 'react'

export function lazyRouteComponent<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(loader)

  return function LazyRouteComponent(props: ComponentProps<T>) {
    return (
      <Suspense fallback={null}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}
