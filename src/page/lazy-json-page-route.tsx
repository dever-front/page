import { lazyRouteComponent } from '@/lib/lazy-route'
import { FrontBootScreen } from '@/components/layout/front-boot-screen'

const LazyPage = lazyRouteComponent(
  () => import('@/page/page').then((mod) => ({ default: mod.Page })),
  <FrontBootScreen />
)

type LazyJsonPageRouteProps = {
  route: string
}

export function LazyJsonPageRoute({ route }: LazyJsonPageRouteProps) {
  return <LazyPage route={route} />
}
