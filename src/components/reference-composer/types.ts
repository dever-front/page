import type { PowerParam } from '@/components/agent/stream-request-params'

export type ReferenceType = 'message' | 'artifact' | 'upload_file' | 'session'

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
}

export type ReferencePreviewLoader = (
  request: ReferencePreviewRequest
) => Promise<ReferencePreview>

export type ReferencePart =
  | { type: 'text'; text: string }
  | {
      type: 'reference'
      ref_type: ReferenceType
      ref_id: number
      label: string
      usage?: string
    }

export type ReferenceContent = {
  version: 1
  parts: ReferencePart[]
  params?: Record<string, unknown>
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

export type ReferenceComposerProps = {
  placeholder?: string
  disabled?: boolean
  running?: boolean
  stopping?: boolean
  cancelable?: boolean
  className?: string
  layerZIndex?: number
  parameters?: ReferenceComposerParam[]
  loadReferences: (
    request: ReferenceLoadRequest
  ) => Promise<ReferenceLoadResult>
  loadPreview: ReferencePreviewLoader
  onSubmit: (input: ReferenceInput) => void | Promise<void>
  onCancel?: () => void | Promise<void>
}
