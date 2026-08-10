import { hideInitialBootScreen } from '@/lib/initial-boot'
import { Page } from '@/page/page'

type JsonPageRouteProps = {
  route: string
}

export function JsonPageRoute({ route }: JsonPageRouteProps) {
  return <Page route={route} onReady={hideInitialBootScreen} />
}
