import type { ReactNode } from 'react'
import type {
  ParamFileLibraryRenderer,
  PowerParam,
} from '@/components/agent/stream-request-params'
import type { UploadFileItem } from '@/lib/upload'

export type ReferenceType =
  | 'message'
  | 'artifact'
  | 'upload_file'
  | 'session'
  | 'canvas_node'
  | 'asset'

export type ReferenceUsageField = 'usage' | 'purpose'

export type ReferencePreviewHint = {
  text?: string
  kind?: string
  url?: string
  sourceUrl?: string
}

export type ReferencePreviewMedia = {
  refType?: ReferenceType
  refId?: number
  artifactId?: number
  fileId?: number
  seriesId?: number
  kind: string
  name?: string
  label: string
  url: string
  index?: number
}

export type ReferencePreview = {
  refType: ReferenceType
  refId: number
  title: string
  text: string
  media: ReferencePreviewMedia[]
  content?: unknown
}

export type ReferencePreviewRequest = {
  refType: ReferenceType
  refId: number
  label: string
  trigger?: string
  versionId?: number
}

export type ReferencePreviewLoader = (
  request: ReferencePreviewRequest
) => Promise<ReferencePreview>

export type ReferenceMediaSelectionItem = {
  url: string
  index: number
  usage?: string
}

export type ReferencePart =
  | { type: 'text'; text: string }
  | {
      type: 'reference'
      ref_type: ReferenceType
      ref_id: number
      label: string
      usage?: string
      purpose?: string
      ref_trigger?: string
      ref_version_id?: number
      ref_origin?: string
      ref_origin_id?: string
      ref_media_url?: string
      ref_media_index?: number
      ref_media_count?: number
      ref_media_items?: ReferenceMediaSelectionItem[]
    }

export type ReferenceContent = {
  version: 1
  parts: ReferencePart[]
  params?: Record<string, unknown>
  execution?: Record<string, unknown>
}

export type ReferenceInput = {
  text: string
  content: ReferenceContent
  params?: Record<string, unknown>
}

export type ReferenceComposerParam = PowerParam

export type ReferenceScope = 'current' | 'history'

export type ReferenceOption = {
  key: string
  refType: ReferenceType
  refId: number
  label: string
  description?: string
  messageRole?: 'user' | 'assistant'
  preview?: ReferencePreviewHint
  materials?: ReferenceOption[]
  selectable?: boolean
  hasChildren?: boolean
  usage?: string
  purpose?: string
  trigger?: string
  versionID?: number
  origin?: string
  originID?: string
  mediaURL?: string
  mediaIndex?: number
  mediaCount?: number
  mediaItems?: ReferenceMediaSelectionItem[]
}

export type ReferenceUsageOption = {
  key: string
  label: string
  acceptedKinds?: string[]
  maxFiles?: number
}

export type ReferencePickerRequest = {
  id: string | number
  trigger?: string
  preferredUsage?: string
  acceptedKinds?: string[]
}

export type ReferenceLoadRequest = {
  scope: ReferenceScope
  query: string
  cursor?: string
  parent?: ReferenceOption
}

export type ReferenceLoadResult = {
  items: ReferenceOption[]
  nextCursor?: string
}

export type ReferenceProviderPickerProps = {
  open: boolean
  acceptedKinds?: string[]
  preferredUsage?: string
  maxSelection?: number
  selectedReferences?: Extract<ReferencePart, { type: 'reference' }>[]
  onSelect: (option: ReferenceOption) => void
  onSelectMany?: (options: ReferenceOption[]) => void
  onClose: () => void
}

export type ReferenceProvider = {
  trigger: string
  referenceTypes: ReferenceType[]
  loadReferences?: (
    request: ReferenceLoadRequest
  ) => Promise<ReferenceLoadResult>
  loadPreview?: ReferencePreviewLoader
  availableScopes?: ReferenceScope[]
  searchPlaceholder?: string
  renderPicker?: (props: ReferenceProviderPickerProps) => ReactNode
}

export type ReferenceComposerProps = {
  placeholder?: string
  disabled?: boolean
  running?: boolean
  stopping?: boolean
  cancelable?: boolean
  className?: string
  layerZIndex?: number
  clipboardImageUploadRuleId?: number
  uploadBizKey?: string
  uploadBizName?: string
  allowResourceLibrary?: boolean
  renderFileLibrary?: ParamFileLibraryRenderer
  toolbar?: ReactNode
  parameterScopeKey?: string
  showMediaAliases?: boolean
  allowMultiMediaSelection?: boolean
  onUploadedFiles?: (files: UploadFileItem[]) => void | Promise<void>
  parameters?: ReferenceComposerParam[]
  providers?: ReferenceProvider[]
  loadReferences?: (
    request: ReferenceLoadRequest
  ) => Promise<ReferenceLoadResult>
  loadPreview?: ReferencePreviewLoader
  onSubmit: (input: ReferenceInput) => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

export type ReferenceEditorProps = {
  value: string
  content?: ReferenceContent
  references: ReferenceOption[]
  placeholder?: string
  disabled?: boolean
  textEditable?: boolean
  autoFocus?: boolean
  className?: string
  layerZIndex?: number
  pickerScopes?: ReferenceScope[]
  pickerSearchPlaceholder?: string
  providers?: ReferenceProvider[]
  loadReferences?: (
    request: ReferenceLoadRequest
  ) => Promise<ReferenceLoadResult>
  loadPreview?: ReferencePreviewLoader
  usageOptions?: ReferenceUsageOption[]
  usageField?: ReferenceUsageField
  mediaUsageOptions?: ReferenceUsageOption[]
  autoAssignUsage?: boolean
  showMediaAliases?: boolean
  allowMultiMediaSelection?: boolean
  pickerRequest?: ReferencePickerRequest
  onPickerRequestConsumed?: (requestID: ReferencePickerRequest['id']) => void
  onReferenceDelete?: (
    reference: Extract<ReferencePart, { type: 'reference' }>
  ) => void
  onReferenceUsageChange?: (
    reference: Extract<ReferencePart, { type: 'reference' }>,
    usage: string
  ) => boolean | void
  onChange: (value: string, content: ReferenceContent) => void
  onBlur?: () => void
  onSubmit?: () => void
}
