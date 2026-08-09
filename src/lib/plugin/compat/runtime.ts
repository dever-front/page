import { runtimeCompatSources as source } from './sources'

export const runtimeCompatModuleLoaders = {
  [source.appConfig]: () => import('@/config/app-config'),
  [source.themeProvider]: () => import('@/context/theme-provider'),
  [source.uploadRuleMetas]: () => import('@/hooks/use-upload-rule-metas'),
  [source.authRedirect]: () => import('@/lib/auth-redirect'),
  [source.icon]: () => import('@/lib/icon'),
  [source.pageDataReload]: () => import('@/lib/page-data-reload'),
  [source.pageSchemaReload]: () => import('@/lib/page-schema-reload'),
  [source.request]: () => import('@/lib/request'),
  [source.runtimeStreamOutput]: () => import('@/lib/runtime-stream-output'),
  [source.runtimeStreamRunner]: () => import('@/lib/runtime-stream-runner'),
  [source.store]: () => import('@/lib/store'),
  [source.stream]: () => import('@/lib/stream'),
  [source.upload]: () => import('@/lib/upload'),
  [source.utils]: () => import('@/lib/utils'),
  [source.authStore]: () => import('@/stores/auth-store'),
}
