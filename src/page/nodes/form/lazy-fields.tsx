import { lazyRouteComponent } from '@/lib/lazy-route'

const loadForm = () => import('@/page/nodes/groups/form')

export const LazyFormSelect = lazyRouteComponent(() =>
  loadForm().then((module) => ({ default: module.FormSelect }))
)

export const LazyFormCascader = lazyRouteComponent(() =>
  loadForm().then((module) => ({ default: module.FormCascader }))
)

export const LazyFormEditor = lazyRouteComponent(() =>
  import('@/page/nodes/groups/rich-editor').then((module) => ({
    default: module.FormEditor,
  }))
)
