import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { ReferenceNodeOptions } from './reference-node'
import { ReferenceTag } from './reference-tag'
import type { ReferencePreviewHint, ReferenceType } from './types'
import { compatibleReferenceUsageOptions } from './reference-usage'
import { referenceTrigger } from './text'

export function ReferenceNodeView({
  node,
  selected,
  deleteNode,
  updateAttributes,
  extension,
}: NodeViewProps) {
  const refType = referenceType(node.attrs.refType)
  const refId = Number(node.attrs.refId || 0)
  const label = String(node.attrs.label || '').trim()
  const trigger = referenceTrigger(String(node.attrs.trigger || ''))
  const versionId = Number(node.attrs.versionId || 0)
  const hint = referencePreviewHint(node.attrs)
  const options = extension.options as ReferenceNodeOptions
  const loadPreview = options.loadPreview
  const usage = String(node.attrs.usage || '')
  const usageOptions = compatibleReferenceUsageOptions(
    options.usageOptions || [],
    hint?.kind
  )
  const usageSupported = usageOptions.some((option) => option.key === usage)

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
      {usageOptions.length > 1 ? (
        <select
          className='reference-node-usage'
          aria-label={`设置${label || '引用素材'}用途`}
          value={usageSupported ? usage : ''}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => updateAttributes({ usage: event.target.value })}
        >
          {!usageSupported ? <option value=''>选择用途</option> : null}
          {usageOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
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
