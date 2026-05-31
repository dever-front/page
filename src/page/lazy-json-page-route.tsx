import { hideInitialBootScreen } from '@/lib/initial-boot'
import { lazyRouteComponent } from '@/lib/lazy-route'
import { FrontBootFallback } from '@/components/layout/front-boot-screen'

const LazyPage = lazyRouteComponent(
  () => import('@/page/page').then((mod) => ({ default: mod.Page })),
  <FrontBootFallback />
)

type LazyJsonPageRouteProps = {
  route: string
}

export function LazyJsonPageRoute({ route }: LazyJsonPageRouteProps) {
  return <LazyPage route={route} onReady={hideInitialBootScreen} />
}
