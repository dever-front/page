import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { ReferenceNodeOptions } from './reference-node'
import { ReferenceTag } from './reference-tag'
import type { ReferencePreviewHint, ReferenceType } from './types'
import { referenceTrigger } from './text'

export function ReferenceNodeView({
  node,
  selected,
  deleteNode,
  extension,
}: NodeViewProps) {
  const refType = referenceType(node.attrs.refType)
  const refId = Number(node.attrs.refId || 0)
  const label = String(node.attrs.label || '').trim()
  const trigger = referenceTrigger(String(node.attrs.trigger || ''))
  const versionId = Number(node.attrs.versionId || 0)
  const hint = referencePreviewHint(node.attrs)
  const loadPreview = (extension.options as ReferenceNodeOptions).loadPreview

  return (
    <NodeViewWrapper
      as='span'
      className='reference-node-view'
      contentEditable={false}
    >
      <ReferenceTag
        label={label}
        refType={refType}
        refId={refId}
        trigger={trigger}
        versionId={versionId}
        hint={hint}
        loadPreview={loadPreview}
        selected={selected}
        className='!mx-0'
        onDelete={deleteNode}
      />
    </NodeViewWrapper>
  )
}

function referenceType(value: unknown): ReferenceType {
  const current = String(value || '')
  if (
    current === 'message' ||
    current === 'artifact' ||
    current === 'upload_file' ||
    current === 'session' ||
    current === 'canvas_node' ||
    current === 'asset'
  ) {
    return current
  }
  return 'message'
}

function referencePreviewHint(
  attrs: Record<string, unknown>
): ReferencePreviewHint | undefined {
  const preview = {
    text: String(attrs.previewText || '').trim() || undefined,
    kind: String(attrs.previewKind || '').trim() || undefined,
    url: String(attrs.previewUrl || '').trim() || undefined,
  }
  return preview.text || preview.kind || preview.url ? preview : undefined
}
