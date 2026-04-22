/**
 * registry.ts - 组件注册表
 * layout 组件和 node 组件的统一注册
 * 所有组件都必须通过注册表使用
 */
import type { ComponentType } from 'react'
import type { LayoutComponentProps } from '@/page/layout/types'
import type { NodeItemProps } from '@/page/nodes'

// ========== Layout 组件注册 ==========

import { Container } from '@/page/layout/container'
import { Header } from '@/page/layout/header'
import { Footer } from '@/page/layout/footer'
import { Main } from '@/page/layout/main'
import { Aside } from '@/page/layout/aside'
import { Row } from '@/page/layout/row'
import { Col } from '@/page/layout/col'

export const layoutRegistry: Record<string, ComponentType<LayoutComponentProps>> = {
  container: Container,
  header: Header,
  footer: Footer,
  main: Main,
  aside: Aside,
  row: Row,
  col: Col,
}

// ========== Node 组件注册 ==========

// Show
import { ShowBase } from '@/page/nodes/show/base'
import { ShowRich } from '@/page/nodes/show/rich'
import { ShowText } from '@/page/nodes/show/text'
import { ShowLink } from '@/page/nodes/show/link'
import { ShowButton } from '@/page/nodes/show/button'
import { ShowButtonGroup } from '@/page/nodes/show/button-group'
import { ShowTag } from '@/page/nodes/show/tag'
import { ShowSelect } from '@/page/nodes/show/select'
import { ShowStatus } from '@/page/nodes/show/status'
import { ShowStatCard } from '@/page/nodes/show/stat-card'
import { ShowChart } from '@/page/nodes/show/chart'
import { ShowTable } from '@/page/nodes/show/table'
import { ShowPage } from '@/page/nodes/show/page'
import { ShowIcon } from '@/page/nodes/show/icon'
import { ShowTooltip } from '@/page/nodes/show/tooltip'
import { ShowCategoryList } from '@/page/nodes/show/category-list'
import { ShowResource } from '@/page/nodes/show/resource'
import { NavTab } from '@/page/nodes/nav/tab'

// Form
import { FormInput } from '@/page/nodes/form/input'
import { FormIcon } from '@/page/nodes/form/icon'
import { FormPassword } from '@/page/nodes/form/password'
import { FormTextarea } from '@/page/nodes/form/textarea'
import { FormUpload } from '@/page/nodes/form/upload'
import { FormEditor } from '@/page/nodes/form/editor'
import { FormNumber } from '@/page/nodes/form/number'
import { FormSwitch } from '@/page/nodes/form/switch'
import { FormRadio } from '@/page/nodes/form/radio'
import { FormCheckbox } from '@/page/nodes/form/checkbox'
import { FormSelect } from '@/page/nodes/form/select'
import { FormTree } from '@/page/nodes/form/tree'
import { FormCascader } from '@/page/nodes/form/cascader'
import { FormDate } from '@/page/nodes/form/date'
import { FormArray } from '@/page/nodes/form/array'

// Media
import { MediaImage } from '@/page/nodes/media/image'
import { MediaAudio } from '@/page/nodes/media/audio'
import { MediaVideo } from '@/page/nodes/media/video'
import { MediaFileList } from '@/page/nodes/media/file-list'

// Feedback
import { FeedbackModal } from '@/page/nodes/feedback/modal'
import { FeedbackAlert } from '@/page/nodes/feedback/alert'
import { FeedbackConfirm } from '@/page/nodes/feedback/confirm'
import { FeedbackDrawer } from '@/page/nodes/feedback/drawer'

export const nodeRegistry: Record<string, ComponentType<NodeItemProps>> = {
  // Show
  'show-base': ShowBase,
  'show-rich': ShowRich,
  'show-text': ShowText,
  'show-link': ShowLink,
  'show-button': ShowButton,
  'show-button-group': ShowButtonGroup,
  'show-tag': ShowTag,
  'show-select': ShowSelect,
  'show-status': ShowStatus,
  'show-stat-card': ShowStatCard,
  'show-chart': ShowChart,
  'show-table': ShowTable,
  'show-page': ShowPage,
  'show-icon': ShowIcon,
  'show-tooltip': ShowTooltip,
  'show-category-list': ShowCategoryList,
  'show-resource': ShowResource,
  'show-resource-browser': ShowResource,
  'nav-tab': NavTab,

  // Form
  'form-input': FormInput,
  'form-icon': FormIcon,
  'form-password': FormPassword,
  'form-textarea': FormTextarea,
  'form-upload': FormUpload,
  'form-editor': FormEditor,
  'form-number': FormNumber,
  'form-switch': FormSwitch,
  'form-radio': FormRadio,
  'form-checkbox': FormCheckbox,
  'form-select': FormSelect,
  'form-tree': FormTree,
  'form-cascader': FormCascader,
  'form-date': FormDate,
  'form-array': FormArray,

  // Media
  'media-image': MediaImage,
  'media-audio': MediaAudio,
  'media-video': MediaVideo,
  'media-file-list': MediaFileList,

  // Feedback
  'feedback-modal': FeedbackModal,
  'feedback-alert': FeedbackAlert,
  'feedback-confirm': FeedbackConfirm,
  'feedback-drawer': FeedbackDrawer,
}
