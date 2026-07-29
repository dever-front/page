import { useEffect, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  referencePartFromAttributes,
  referenceTypeFromValue,
  type ReferenceNodeOptions,
} from './reference-node'
import { ReferenceTag } from './reference-tag'
import type { ReferencePreviewHint } from './types'
import { loadReferencePreview } from './reference-preview-cache'
import { compatibleReferenceUsageOptions } from './reference-usage'
import { referenceTrigger } from './text'

export function ReferenceNodeView({
  node,
  selected,
  deleteNode,
  updateAttributes,
  extension,
}: NodeViewProps) {
  const refType = referenceTypeFromValue(node.attrs.refType)
  const refId = Number(node.attrs.refId || 0)
  const label = String(node.attrs.label || '').trim()
  const trigger = referenceTrigger(String(node.attrs.trigger || ''))
  const versionId = Number(node.attrs.versionId || 0)
  const staticHint = referencePreviewHint(node.attrs)
  const options = extension.options as ReferenceNodeOptions
  const loadPreview = options.loadPreview
  const loadedHint = useMissingPreviewHint({
    label,
    refId,
    refType,
    trigger,
    versionId,
    hint: staticHint,
    loadPreview,
  })
  const hint = mergePreviewHints(staticHint, loadedHint)
  const usage = String(node.attrs.usage || '')
  const usageOptions = compatibleReferenceUsageOptions(
    options.usageOptions || [],
    hint?.kind
  )
  const usageSupported = usageOptions.some((option) => option.key === usage)
  const reference = referencePartFromAttributes(node.attrs)

  const deleteReference = () => {
    options.onDeleteReference?.(reference)
    deleteNode()
  }

  const changeUsage = (nextUsage: string) => {
    options.onUsageChange?.(reference, nextUsage)
    updateAttributes({ usage: nextUsage })
  }

  return (
    <NodeViewWrapper
      as='span'
      className='reference-node-view'
      contentEditable={false}
      data-drag-handle=''
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
        usage={usageSupported ? usage : ''}
        usageOptions={usageOptions}
        onUsageChange={changeUsage}
        onDelete={deleteReference}
      />
    </NodeViewWrapper>
  )
}

function useMissingPreviewHint({
  label,
  refId,
  refType,
  trigger,
  versionId,
  hint,
  loadPreview,
}: {
  label: string
  refId: number
  refType: ReturnType<typeof referenceTypeFromValue>
  trigger: string
  versionId: number
  hint?: ReferencePreviewHint
  loadPreview?: ReferenceNodeOptions['loadPreview']
}) {
  const [loadedHint, setLoadedHint] = useState<ReferencePreviewHint>()

  useEffect(() => {
    setLoadedHint(undefined)
    if (hint?.kind || !loadPreview || refId <= 0) {
      return
    }

    let active = true
    void loadReferencePreview(loadPreview, {
      refType,
      refId,
      label,
      trigger,
      versionId,
    }).then((preview) => {
      if (!active) {
        return
      }
      const media = preview.media[0]
      setLoadedHint({
        text: preview.text.trim() || undefined,
        kind: media?.kind || undefined,
        url: media?.url || undefined,
      })
    }).catch(() => {
      // The hover preview owns error presentation; a missing inline hint is harmless.
    })

    return () => {
      active = false
    }
  }, [hint?.kind, label, loadPreview, refId, refType, trigger, versionId])

  return loadedHint
}

function mergePreviewHints(
  primary?: ReferencePreviewHint,
  fallback?: ReferencePreviewHint
) {
  if (!primary) {
    return fallback
  }
  if (!fallback) {
    return primary
  }
  return {
    text: primary.text || fallback.text,
    kind: primary.kind || fallback.kind,
    url: primary.url || fallback.url,
    sourceUrl: primary.sourceUrl || fallback.sourceUrl,
  }
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
