import { lazyRouteComponent } from '@/lib/lazy-route'

export const LazyFormSelect = lazyRouteComponent(() =>
  import('./select').then((module) => ({ default: module.FormSelect }))
)

export const LazyFormCascader = lazyRouteComponent(() =>
  import('./cascader').then((module) => ({ default: module.FormCascader }))
)

export const LazyFormEditor = lazyRouteComponent(() =>
  import('./editor').then((module) => ({ default: module.FormEditor }))
)
