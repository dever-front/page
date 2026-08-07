import { getSiteConfig } from '@/config/app-config'
import * as themeProvider from '@/context/theme-provider'
import * as uploadRuleMetas from '@/hooks/use-upload-rule-metas'
import * as authRedirect from '@/lib/auth-redirect'
import * as icon from '@/lib/icon'
import * as pageDataReload from '@/lib/page-data-reload'
import * as pageSchemaReload from '@/lib/page-schema-reload'
import * as request from '@/lib/request'
import * as runtimeStreamOutput from '@/lib/runtime-stream-output'
import * as runtimeStreamRunner from '@/lib/runtime-stream-runner'
import * as store from '@/lib/store'
import * as stream from '@/lib/stream'
import * as upload from '@/lib/upload'
import * as utils from '@/lib/utils'
import * as authStore from '@/stores/auth-store'
import { runtimeCompatSources as source } from './sources'

export const compatModules = {
  [source.appConfig]: { getSiteConfig },
  [source.themeProvider]: themeProvider,
  [source.uploadRuleMetas]: uploadRuleMetas,
  [source.authRedirect]: authRedirect,
  [source.icon]: icon,
  [source.pageDataReload]: pageDataReload,
  [source.pageSchemaReload]: pageSchemaReload,
  [source.request]: request,
  [source.runtimeStreamOutput]: runtimeStreamOutput,
  [source.runtimeStreamRunner]: runtimeStreamRunner,
  [source.store]: store,
  [source.stream]: stream,
  [source.upload]: upload,
  [source.utils]: utils,
  [source.authStore]: authStore,
}
