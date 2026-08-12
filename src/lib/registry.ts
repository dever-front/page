/**
 * registry.ts - 组件注册表
 * layout 组件和 node 组件的统一注册
 * 所有组件都必须通过注册表使用
 */
import { type ComponentType } from 'react'
import { Aside } from '@/page/layout/aside'
import {
  CardContentLayout,
  CardFooterLayout,
  CardHeaderLayout,
  CardLayout,
} from '@/page/layout/card'
import { Col } from '@/page/layout/col'
// ========== Layout 组件注册 ==========

import { Container } from '@/page/layout/container'
import { Footer } from '@/page/layout/footer'
import { Header } from '@/page/layout/header'
import { Main } from '@/page/layout/main'
import { Row } from '@/page/layout/row'
import { ShellSidebarInset } from '@/page/layout/shell-sidebar-inset'
import type { LayoutComponentProps } from '@/page/layout/types'
import type { NodeItemProps } from '@/page/nodes'
import {
  ensurePluginsForNodes,
  getRuntimePluginNodes,
} from '@/lib/plugin/runtime'
import { lazyNode } from '@/lib/plugin/types'
import type { LazyNodeComponent } from '@/lib/plugin/types'
import type { PageSchemaType } from '@/lib/schema'
import { collectSchemaNodeTypes } from '@/lib/schema-nodes'

export const layoutRegistry: Record<
  string,
  ComponentType<LayoutComponentProps>
> = {
  container: Container,
  header: Header,
  footer: Footer,
  main: Main,
  aside: Aside,
  row: Row,
  col: Col,
  card: CardLayout,
  'card-header': CardHeaderLayout,
  'card-content': CardContentLayout,
  'card-footer': CardFooterLayout,
  'shell-sidebar-inset': ShellSidebarInset,
}

// ========== Node 组件注册 ==========

const loadAppShellNodes = () => import('@/page/nodes/groups/app-shell')
const loadAppAuthNodes = () => import('@/page/nodes/groups/app-auth')
const loadShowNodes = () => import('@/page/nodes/groups/show')
const loadFormNodes = () => import('@/page/nodes/groups/form')
const loadDataEditorNodes = () =>
  import('@/page/nodes/groups/data-editor')
const loadRichEditorNodes = () =>
  import('@/page/nodes/groups/rich-editor')
const loadMediaNodes = () => import('@/page/nodes/groups/media')

function createLazyNodeGroup<T>(loadGroup: () => Promise<T>) {
  return (componentName: keyof T) =>
    lazyNode(() =>
      loadGroup().then((group) => ({
        default: group[componentName] as ComponentType<NodeItemProps>,
      }))
    )
}

const appShellNode = createLazyNodeGroup(loadAppShellNodes)
const appAuthNode = createLazyNodeGroup(loadAppAuthNodes)
const showNode = createLazyNodeGroup(loadShowNodes)
const formNode = createLazyNodeGroup(loadFormNodes)
const dataEditorNode = createLazyNodeGroup(loadDataEditorNodes)
const richEditorNode = createLazyNodeGroup(loadRichEditorNodes)
const mediaNode = createLazyNodeGroup(loadMediaNodes)

const coreNodeRegistry: Record<string, LazyNodeComponent> = {
  // App shell/auth
  'app-site-brand': appAuthNode('AppSiteBrand'),
  'app-login-form': appAuthNode('AppLoginForm'),
  'app-skip-to-main': appShellNode('AppSkipToMain'),
  'app-sidebar': appShellNode('AppSidebarNode'),
  'app-topbar': appShellNode('AppTopbarNode'),
  'app-outlet': appShellNode('AppOutletNode'),
  'app-assistant': appShellNode('AppAssistantNode'),

  // Show
  'show-base': showNode('ShowBase'),
  'show-title': showNode('ShowTitle'),
  'show-rich': showNode('ShowRich'),
  'show-text': showNode('ShowText'),
  'show-date': showNode('ShowDate'),
  'show-link': showNode('ShowLink'),
  'show-button': showNode('ShowButton'),
  'show-button-group': showNode('ShowButtonGroup'),
  'show-tag': showNode('ShowTag'),
  'show-select': showNode('ShowSelect'),
  'show-status': showNode('ShowStatus'),
  'show-stat-card': showNode('ShowStatCard'),
  'show-chart': lazyNode(() =>
    import('@/page/nodes/show/chart').then((mod) => ({
      default: mod.ShowChart,
    }))
  ),
  'show-table': dataEditorNode('ShowTable'),
  'show-page': showNode('ShowPage'),
  'show-icon': showNode('ShowIcon'),
  'show-tooltip': showNode('ShowTooltip'),
  'show-category-list': showNode('ShowCategoryList'),
  'show-resource': showNode('ShowResource'),
  'show-resource-browser': showNode('ShowResource'),
  'nav-tab': showNode('NavTab'),

  // Form
  'form-input': formNode('FormInput'),
  'form-color': formNode('FormColor'),
  'form-icon': formNode('FormIcon'),
  'form-password': formNode('FormPassword'),
  'form-textarea': formNode('FormTextarea'),
  'form-upload': formNode('FormUpload'),
  'form-editor': richEditorNode('FormEditor'),
  'form-number': formNode('FormNumber'),
  'form-switch': formNode('FormSwitch'),
  'form-radio': formNode('FormRadio'),
  'form-checkbox': formNode('FormCheckbox'),
  'form-select': formNode('FormSelect'),
  'form-tree': formNode('FormTree'),
  'form-cascader': formNode('FormCascader'),
  'form-date': formNode('FormDate'),
  'form-array': dataEditorNode('FormArray'),
  'form-combo-mapping': formNode('FormComboMapping'),
  'type-editor': dataEditorNode('TypeEditor'),

  // Data
  'front-data-record-editor': formNode('DataRecordEditor'),

  // Media
  'media-image': mediaNode('MediaImage'),
  'media-audio': mediaNode('MediaAudio'),
  'media-video': mediaNode('MediaVideo'),
  'media-file-list': mediaNode('MediaFileList'),

  // Feedback
  'feedback-modal': showNode('FeedbackModal'),
  'feedback-alert': showNode('FeedbackAlert'),
  'feedback-confirm': showNode('FeedbackConfirm'),
  'feedback-drawer': showNode('FeedbackDrawer'),
}

export function getNodeComponent(type: string) {
  return coreNodeRegistry[type] || getRuntimePluginNodes()[type]
}

export function ensureNodePluginsForSchema(schema: PageSchemaType) {
  const pluginNodeTypes = collectSchemaNodeTypes(schema).filter(
    (type) => !coreNodeRegistry[type] && !getRuntimePluginNodes()[type]
  )
  return ensurePluginsForNodes(pluginNodeTypes)
}
