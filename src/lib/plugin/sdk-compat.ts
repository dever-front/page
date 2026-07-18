import { useNavigate, useSearch } from '@tanstack/react-router'
import { getSiteConfig } from '@/config/app-config'
import * as authStoreModule from '@/stores/auth-store'
import * as themeProviderModule from '@/context/theme-provider'
import * as agentResultProtocolModule from '@/lib/agent-result-protocol'
import * as agentRunnerModule from '@/lib/agent/runner'
import * as assistantContextModule from '@/lib/assistant/context'
import * as assistantReferenceModule from '@/lib/assistant/reference'
import * as authRedirectModule from '@/lib/auth-redirect'
import * as floatingLayerModule from '@/lib/floating-layer'
import * as iconModule from '@/lib/icon'
import * as pageSchemaReloadModule from '@/lib/page-schema-reload'
import * as requestModule from '@/lib/request'
import * as resourceModule from '@/lib/resource'
import * as runtimeStreamOutputModule from '@/lib/runtime-stream-output'
import * as runtimeStreamRunnerModule from '@/lib/runtime-stream-runner'
import * as storeModule from '@/lib/store'
import * as streamModule from '@/lib/stream'
import * as uploadModule from '@/lib/upload'
import * as utilsModule from '@/lib/utils'
import * as richTextHtmlModule from '@/lib/rich-text-html'
import * as uploadRuleMetasModule from '@/hooks/use-upload-rule-metas'
import { Button, buttonVariants } from '@/components/ui/button'
import * as cardModule from '@/components/ui/card'
import * as dialogModule from '@/components/ui/dialog'
import * as inputModule from '@/components/ui/input'
import * as radioGroupModule from '@/components/ui/radio-group'
import * as selectModule from '@/components/ui/select'
import * as sheetModule from '@/components/ui/sheet'
import * as textareaModule from '@/components/ui/textarea'
import * as formDateModule from '@/page/nodes/form/date'
import * as showTooltipModule from '@/page/nodes/show/tooltip'
import * as agentInteractionPanelModule from '@/components/agent/interaction-panel'
import * as agentStreamRequestParamsModule from '@/components/agent/stream-request-params'
import * as assistantFormActionsModule from '@/components/assistant/form-actions'
import * as assistantMemoryDialogModule from '@/components/assistant/memory-dialog'
import * as assistantReferencePickerModule from '@/components/assistant/reference-picker'
import * as assistantSessionHistoryDialogModule from '@/components/assistant/session-history-dialog'
import * as assistantTaskPopoverModule from '@/components/assistant/task-popover'
import * as confirmDialogModule from '@/components/confirm-dialog'
import * as energonContentViewModule from '@/components/energon/content-view'
import * as energonProgressModule from '@/components/energon/progress'
import * as siteLogoModule from '@/components/layout/site-logo'
import * as richTextEditorModule from '@/components/rich-text-editor'
import * as richTextViewModule from '@/components/rich-text-view'
import * as referenceComposerModule from '@/components/reference-composer'
import * as searchableOptionPickerModule from '@/components/searchable-option-picker'
import * as streamTimingModule from '@/components/stream-timing'
import { defineFrontPlugin, lazyNode, mergePluginNodes } from './types'

export type FrontPluginSDK = {
  defineFrontPlugin: typeof defineFrontPlugin
  lazyNode: typeof lazyNode
  mergePluginNodes: typeof mergePluginNodes
  useNavigate: typeof useNavigate
  useSearch: typeof useSearch
  getCompatModule: (path: string) => Record<string, any>
}

export function createFrontPluginSDK(): FrontPluginSDK {
  const modules = createCompatModules()
  return {
    defineFrontPlugin,
    lazyNode,
    mergePluginNodes,
    useNavigate,
    useSearch,
    getCompatModule(path) {
      return modules[path] || {}
    },
  }
}

function createCompatModules(): Record<string, Record<string, any>> {
  return {
    '@/components/agent/interaction-panel': agentInteractionPanelModule,
    '@/components/agent/stream-request-params': agentStreamRequestParamsModule,
    '@/components/assistant/form-actions': assistantFormActionsModule,
    '@/components/assistant/memory-dialog': assistantMemoryDialogModule,
    '@/components/assistant/reference-picker': assistantReferencePickerModule,
    '@/components/assistant/session-history-dialog':
      assistantSessionHistoryDialogModule,
    '@/components/assistant/task-popover': assistantTaskPopoverModule,
    '@/components/confirm-dialog': confirmDialogModule,
    '@/components/energon/content-view': energonContentViewModule,
    '@/components/energon/progress': energonProgressModule,
    '@/components/layout/site-logo': siteLogoModule,
    '@/components/rich-text-editor': richTextEditorModule,
    '@/components/rich-text-view': richTextViewModule,
    '@/components/reference-composer': referenceComposerModule,
    '@/components/searchable-option-picker': searchableOptionPickerModule,
    '@/components/stream-timing': streamTimingModule,
    '@/components/ui/button': { Button, buttonVariants },
    '@/components/ui/card': cardModule,
    '@/components/ui/dialog': dialogModule,
    '@/components/ui/input': inputModule,
    '@/components/ui/radio-group': radioGroupModule,
    '@/components/ui/select': selectModule,
    '@/components/ui/sheet': sheetModule,
    '@/components/ui/textarea': textareaModule,
    '@/config/app-config': { getSiteConfig },
    '@/context/theme-provider': themeProviderModule,
    '@/hooks/use-upload-rule-metas': uploadRuleMetasModule,
    '@/lib/agent-result-protocol': agentResultProtocolModule,
    '@/lib/agent/runner': agentRunnerModule,
    '@/lib/assistant/context': assistantContextModule,
    '@/lib/assistant/reference': assistantReferenceModule,
    '@/lib/auth-redirect': authRedirectModule,
    '@/lib/floating-layer': floatingLayerModule,
    '@/lib/icon': iconModule,
    '@/lib/page-schema-reload': pageSchemaReloadModule,
    '@/lib/plugin/types': {
      defineFrontPlugin,
      lazyNode,
      mergePluginNodes,
    },
    '@/lib/request': requestModule,
    '@/lib/rich-text-html': richTextHtmlModule,
    '@/lib/resource': resourceModule,
    '@/lib/runtime-stream-output': runtimeStreamOutputModule,
    '@/lib/runtime-stream-runner': runtimeStreamRunnerModule,
    '@/lib/store': storeModule,
    '@/lib/stream': streamModule,
    '@/lib/upload': uploadModule,
    '@/lib/utils': utilsModule,
    '@/page/nodes/form/date': formDateModule,
    '@/page/nodes/show/tooltip': showTooltipModule,
    '@/page/nodes': {},
    '@/stores/auth-store': authStoreModule,
  }
}
