/**
 * registry.ts - 组件注册表
 * layout 组件和 node 组件的统一注册
 * 所有组件都必须通过注册表使用
 */
import { type ComponentType } from 'react'
import type { NodeItemProps } from '@/page/nodes'
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
import {
  ensurePluginsForNodes,
  getRuntimePluginNodes,
} from '@/lib/plugin/runtime'
import { lazyNode } from '@/lib/plugin/types'
import type { LazyNodeComponent } from '@/lib/plugin/types'
import type { PageSchemaType } from '@/lib/schema'
import {
  collectImmediateSchemaNodeTypes,
  collectSchemaNodeTypes,
} from '@/lib/schema-nodes'

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
const loadShowNodes = () => import('@/page/nodes/groups/show')
const loadFormBasicNodes = () => import('@/page/nodes/groups/form-basic')
const loadFormTextNodes = () => import('@/page/nodes/groups/form-text')
const loadMediaNodes = () => import('@/page/nodes/groups/media')
const loadFeedbackNodes = () => import('@/page/nodes/groups/feedback')

function createLazyNodeGroup<T>(loadGroup: () => Promise<T>) {
  return (componentName: keyof T) =>
    lazyNode(() =>
      loadGroup().then((group) => ({
        default: group[componentName] as ComponentType<NodeItemProps>,
      }))
    )
}

const appShellNode = createLazyNodeGroup(loadAppShellNodes)
const showNode = createLazyNodeGroup(loadShowNodes)
const formBasicNode = createLazyNodeGroup(loadFormBasicNodes)
const formTextNode = createLazyNodeGroup(loadFormTextNodes)
const mediaNode = createLazyNodeGroup(loadMediaNodes)
const feedbackNode = createLazyNodeGroup(loadFeedbackNodes)

const coreNodeRegistry: Record<string, LazyNodeComponent> = {
  // App shell/auth
  'app-site-brand': lazyNode(() =>
    import('@/page/nodes/app/site-brand').then((mod) => ({
      default: mod.AppSiteBrand,
    }))
  ),
  'app-login-form': lazyNode(() =>
    import('@/page/nodes/app/login-form').then((mod) => ({
      default: mod.AppLoginForm,
    }))
  ),
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
  'show-button-group': lazyNode(() =>
    import('@/page/nodes/show/button-group').then((mod) => ({
      default: mod.ShowButtonGroup,
    }))
  ),
  'show-tag': showNode('ShowTag'),
  'show-select': showNode('ShowSelect'),
  'show-status': showNode('ShowStatus'),
  'show-stat-card': showNode('ShowStatCard'),
  'show-chart': lazyNode(() =>
    import('@/page/nodes/show/chart').then((mod) => ({
      default: mod.ShowChart,
    }))
  ),
  'show-table': lazyNode(() =>
    import('@/page/nodes/show/table').then((mod) => ({
      default: mod.ShowTable,
    }))
  ),
  'show-page': showNode('ShowPage'),
  'show-icon': showNode('ShowIcon'),
  'show-tooltip': showNode('ShowTooltip'),
  'show-category-list': lazyNode(() =>
    import('@/page/nodes/show/category-list').then((mod) => ({
      default: mod.ShowCategoryList,
    }))
  ),
  'show-resource': lazyNode(() =>
    import('@/page/nodes/show/resource').then((mod) => ({
      default: mod.ShowResource,
    }))
  ),
  'show-resource-browser': lazyNode(() =>
    import('@/page/nodes/show/resource').then((mod) => ({
      default: mod.ShowResource,
    }))
  ),
  'nav-tab': lazyNode(() =>
    import('@/page/nodes/nav/tab').then((mod) => ({ default: mod.NavTab }))
  ),

  // Form
  'form-input': formTextNode('FormInput'),
  'form-color': formBasicNode('FormColor'),
  'form-icon': lazyNode(() =>
    import('@/page/nodes/form/icon').then((mod) => ({ default: mod.FormIcon }))
  ),
  'form-password': formBasicNode('FormPassword'),
  'form-textarea': formTextNode('FormTextarea'),
  'form-upload': lazyNode(() =>
    import('@/page/nodes/form/upload').then((mod) => ({
      default: mod.FormUpload,
    }))
  ),
  'form-editor': lazyNode(() =>
    import('@/page/nodes/form/editor').then((mod) => ({
      default: mod.FormEditor,
    }))
  ),
  'form-number': formBasicNode('FormNumber'),
  'form-switch': formBasicNode('FormSwitch'),
  'form-radio': formBasicNode('FormRadio'),
  'form-checkbox': formBasicNode('FormCheckbox'),
  'form-select': lazyNode(() =>
    import('@/page/nodes/form/select').then((mod) => ({
      default: mod.FormSelect,
    }))
  ),
  'form-tree': lazyNode(() =>
    import('@/page/nodes/form/tree').then((mod) => ({ default: mod.FormTree }))
  ),
  'form-cascader': lazyNode(() =>
    import('@/page/nodes/form/cascader').then((mod) => ({
      default: mod.FormCascader,
    }))
  ),
  'form-date': lazyNode(() =>
    import('@/page/nodes/form/date').then((mod) => ({ default: mod.FormDate }))
  ),
  'form-array': lazyNode(() =>
    import('@/page/nodes/form/array').then((mod) => ({
      default: mod.FormArray,
    }))
  ),
  'form-combo-mapping': lazyNode(() =>
    import('@/page/nodes/form/combo-mapping').then((mod) => ({
      default: mod.FormComboMapping,
    }))
  ),
  'type-editor': lazyNode(() =>
    import('@/page/nodes/form/type-editor').then((mod) => ({
      default: mod.TypeEditor,
    }))
  ),

  // Data
  'front-data-record-editor': lazyNode(() =>
    import('@/page/nodes/data-record/editor').then((mod) => ({
      default: mod.DataRecordEditor,
    }))
  ),

  // Media
  'media-image': mediaNode('MediaImage'),
  'media-audio': mediaNode('MediaAudio'),
  'media-video': mediaNode('MediaVideo'),
  'media-file-list': mediaNode('MediaFileList'),

  // Feedback
  'feedback-modal': feedbackNode('FeedbackModal'),
  'feedback-alert': feedbackNode('FeedbackAlert'),
  'feedback-confirm': feedbackNode('FeedbackConfirm'),
  'feedback-drawer': feedbackNode('FeedbackDrawer'),
}

export function getNodeComponent(type: string) {
  return coreNodeRegistry[type] || getRuntimePluginNodes()[type]
}

export function preloadImmediateNodeComponents(schema: PageSchemaType) {
  const nodeTypes = collectImmediateSchemaNodeTypes(schema)
  return Promise.allSettled(
    nodeTypes.map((type) => getNodeComponent(type)?.preload?.())
  )
}

export function ensureNodePluginsForSchema(schema: PageSchemaType) {
  const pluginNodeTypes = collectSchemaNodeTypes(schema).filter(
    (type) => !coreNodeRegistry[type] && !getRuntimePluginNodes()[type]
  )
  return ensurePluginsForNodes(pluginNodeTypes)
}
