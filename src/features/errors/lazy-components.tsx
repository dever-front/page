import type { ComponentType } from 'react'
import { lazyRouteComponent } from '@/lib/lazy-route'

type ErrorComponentName = keyof typeof import('./components')

const loadErrorComponents = () => import('./components')

function lazyErrorComponent(componentName: ErrorComponentName) {
  return lazyRouteComponent(() =>
    loadErrorComponents().then((module) => ({
      default: module[componentName],
    }))
  )
}

export const errorRouteComponents = {
  unauthorized: lazyErrorComponent('UnauthorisedError'),
  forbidden: lazyErrorComponent('ForbiddenError'),
  'not-found': lazyErrorComponent('NotFoundError'),
  'internal-server-error': lazyErrorComponent('GeneralError'),
  'maintenance-error': lazyErrorComponent('MaintenanceError'),
} satisfies Record<string, ComponentType>

export function resolveErrorRouteComponent(error: string) {
  return (
    errorRouteComponents[error as keyof typeof errorRouteComponents] ||
    errorRouteComponents['not-found']
  )
}
