export type ReferenceType =
  | 'message'
  | 'artifact'
  | 'upload_file'
  | 'session'

export type ReferencePreview = {
  text?: string
  kind?: string
  url?: string
}

export type ReferencePart =
  | { type: 'text'; text: string }
  | {
      type: 'reference'
      ref_type: ReferenceType
      ref_id: number
      label: string
      usage?: string
      preview?: ReferencePreview
    }

export type ReferenceContent = {
  version: 1
  parts: ReferencePart[]
}

export type ReferenceInput = {
  text: string
  content: ReferenceContent
}

export type ReferenceScope = 'current' | 'history' | 'resource'

export type ReferenceOption = {
  key: string
  refType: ReferenceType
  refId: number
  label: string
  description?: string
  preview?: ReferencePreview
  parentKey?: string
  selectable?: boolean
  hasChildren?: boolean
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
  loadReferences: (
    request: ReferenceLoadRequest,
  ) => Promise<ReferenceLoadResult>
  onSubmit: (input: ReferenceInput) => void | Promise<void>
  onCancel?: () => void | Promise<void>
}
