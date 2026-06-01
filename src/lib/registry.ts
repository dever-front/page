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
  'app-skip-to-main': lazyNode(() =>
    import('@/page/nodes/app/shell').then((mod) => ({
      default: mod.AppSkipToMain,
    }))
  ),
  'app-sidebar': lazyNode(() =>
    import('@/page/nodes/app/shell').then((mod) => ({
      default: mod.AppSidebarNode,
    }))
  ),
  'app-topbar': lazyNode(() =>
    import('@/page/nodes/app/shell').then((mod) => ({
      default: mod.AppTopbarNode,
    }))
  ),
  'app-outlet': lazyNode(() =>
    import('@/page/nodes/app/shell').then((mod) => ({
      default: mod.AppOutletNode,
    }))
  ),
  'app-assistant': lazyNode(() =>
    import('@/page/nodes/app/shell').then((mod) => ({
      default: mod.AppAssistantNode,
    }))
  ),

  // Show
  'show-base': lazyNode(() =>
    import('@/page/nodes/show/base').then((mod) => ({ default: mod.ShowBase }))
  ),
  'show-title': lazyNode(() =>
    import('@/page/nodes/show/title').then((mod) => ({
      default: mod.ShowTitle,
    }))
  ),
  'show-rich': lazyNode(() =>
    import('@/page/nodes/show/rich').then((mod) => ({ default: mod.ShowRich }))
  ),
  'show-text': lazyNode(() =>
    import('@/page/nodes/show/text').then((mod) => ({ default: mod.ShowText }))
  ),
  'show-date': lazyNode(() =>
    import('@/page/nodes/show/date').then((mod) => ({ default: mod.ShowDate }))
  ),
  'show-link': lazyNode(() =>
    import('@/page/nodes/show/link').then((mod) => ({ default: mod.ShowLink }))
  ),
  'show-button': lazyNode(() =>
    import('@/page/nodes/show/button').then((mod) => ({
      default: mod.ShowButton,
    }))
  ),
  'show-button-group': lazyNode(() =>
    import('@/page/nodes/show/button-group').then((mod) => ({
      default: mod.ShowButtonGroup,
    }))
  ),
  'show-tag': lazyNode(() =>
    import('@/page/nodes/show/tag').then((mod) => ({ default: mod.ShowTag }))
  ),
  'show-select': lazyNode(() =>
    import('@/page/nodes/show/select').then((mod) => ({
      default: mod.ShowSelect,
    }))
  ),
  'show-status': lazyNode(() =>
    import('@/page/nodes/show/status').then((mod) => ({
      default: mod.ShowStatus,
    }))
  ),
  'show-stat-card': lazyNode(() =>
    import('@/page/nodes/show/stat-card').then((mod) => ({
      default: mod.ShowStatCard,
    }))
  ),
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
  'show-page': lazyNode(() =>
    import('@/page/nodes/show/page').then((mod) => ({ default: mod.ShowPage }))
  ),
  'show-icon': lazyNode(() =>
    import('@/page/nodes/show/icon').then((mod) => ({ default: mod.ShowIcon }))
  ),
  'show-tooltip': lazyNode(() =>
    import('@/page/nodes/show/tooltip').then((mod) => ({
      default: mod.ShowTooltip,
    }))
  ),
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
  'form-input': lazyNode(() =>
    import('@/page/nodes/form/input').then((mod) => ({
      default: mod.FormInput,
    }))
  ),
  'form-icon': lazyNode(() =>
    import('@/page/nodes/form/icon').then((mod) => ({ default: mod.FormIcon }))
  ),
  'form-password': lazyNode(() =>
    import('@/page/nodes/form/password').then((mod) => ({
      default: mod.FormPassword,
    }))
  ),
  'form-textarea': lazyNode(() =>
    import('@/page/nodes/form/textarea').then((mod) => ({
      default: mod.FormTextarea,
    }))
  ),
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
  'form-number': lazyNode(() =>
    import('@/page/nodes/form/number').then((mod) => ({
      default: mod.FormNumber,
    }))
  ),
  'form-switch': lazyNode(() =>
    import('@/page/nodes/form/switch').then((mod) => ({
      default: mod.FormSwitch,
    }))
  ),
  'form-radio': lazyNode(() =>
    import('@/page/nodes/form/radio').then((mod) => ({
      default: mod.FormRadio,
    }))
  ),
  'form-checkbox': lazyNode(() =>
    import('@/page/nodes/form/checkbox').then((mod) => ({
      default: mod.FormCheckbox,
    }))
  ),
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

  // Media
  'media-image': lazyNode(() =>
    import('@/page/nodes/media/image').then((mod) => ({
      default: mod.MediaImage,
    }))
  ),
  'media-audio': lazyNode(() =>
    import('@/page/nodes/media/audio').then((mod) => ({
      default: mod.MediaAudio,
    }))
  ),
  'media-video': lazyNode(() =>
    import('@/page/nodes/media/video').then((mod) => ({
      default: mod.MediaVideo,
    }))
  ),
  'media-file-list': lazyNode(() =>
    import('@/page/nodes/media/file-list').then((mod) => ({
      default: mod.MediaFileList,
    }))
  ),

  // Feedback
  'feedback-modal': lazyNode(() =>
    import('@/page/nodes/feedback/modal').then((mod) => ({
      default: mod.FeedbackModal,
    }))
  ),
  'feedback-alert': lazyNode(() =>
    import('@/page/nodes/feedback/alert').then((mod) => ({
      default: mod.FeedbackAlert,
    }))
  ),
  'feedback-confirm': lazyNode(() =>
    import('@/page/nodes/feedback/confirm').then((mod) => ({
      default: mod.FeedbackConfirm,
    }))
  ),
  'feedback-drawer': lazyNode(() =>
    import('@/page/nodes/feedback/drawer').then((mod) => ({
      default: mod.FeedbackDrawer,
    }))
  ),
}

export function getNodeComponent(type: string) {
  return coreNodeRegistry[type] || getRuntimePluginNodes()[type]
}

export function preloadNodeComponents(schema: PageSchemaType) {
  const nodeTypes = collectSchemaNodeTypes(schema)
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
