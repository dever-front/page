import { lazyRouteComponent } from '@/lib/lazy-route'

export const LazyJsonPageRoute = lazyRouteComponent(() =>
  import('@/page/json-page-route').then((module) => ({
    default: module.JsonPageRoute,
  }))
)
