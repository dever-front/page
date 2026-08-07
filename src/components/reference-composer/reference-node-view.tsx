import { useCallback, useEffect, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  referencePartFromAttributes,
  referenceTypeFromValue,
  type ReferenceNodeOptions,
} from './reference-node'
import { normalizeReferenceMediaSelectionItems } from './media-selection'
import { ReferenceTag } from './reference-tag'
import type {
  ReferenceMediaSelectionItem,
  ReferencePreviewHint,
} from './types'
import { loadReferencePreview } from './reference-preview-cache'
import { compatibleReferenceUsageOptions } from './reference-usage'
import { referenceTrigger } from './text'
import { referenceMediaAliasAtPosition } from './reference-alias'

export function ReferenceNodeView({
  node,
  selected,
  deleteNode,
  updateAttributes,
  extension,
  editor,
  getPos,
}: NodeViewProps) {
  const refType = referenceTypeFromValue(node.attrs.refType)
  const refId = Number(node.attrs.refId || 0)
  const label = String(node.attrs.label || '').trim()
  const trigger = referenceTrigger(String(node.attrs.trigger || ''))
  const versionId = Number(node.attrs.versionId || 0)
  const staticHint = referencePreviewHint(node.attrs)
  const options = extension.options as ReferenceNodeOptions
  const alias = useReferenceNodeMediaAlias(
    editor,
    getPos,
    Boolean(options.showMediaAliases)
  )
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

  useEffect(() => {
    const resolvedKind = String(hint?.kind || '').trim()
    const storedKind = String(node.attrs.previewKind || '').trim()
    if (!resolvedKind || storedKind) {
      return
    }
    // Alias numbering reads the shared editor document, so async preview
    // metadata must be reflected there for every reference node to see it.
    updateAttributes({ previewKind: resolvedKind })
  }, [hint?.kind, node.attrs.previewKind, updateAttributes])

  const usage = String(node.attrs.usage || '')
  const usageOptions = compatibleReferenceUsageOptions(
    options.usageOptions || [],
    hint?.kind
  )
  const usageSupported = usageOptions.some((option) => option.key === usage)
  const activeUsage =
    usageOptions.find((option) => option.key === usage) ||
    (usageOptions.length === 1 ? usageOptions[0] : undefined)
  const mediaCount = Number(node.attrs.mediaCount || 0)
  const mediaItems = normalizeReferenceMediaSelectionItems(
    node.attrs.mediaItems
  )
  const mediaCapacity = Number(activeUsage?.maxFiles || 0)
  const mediaSelectable = refType === 'asset'
  const reference = referencePartFromAttributes(node.attrs)
  const disabled = useReferenceNodeDisabled(editor)

  const deleteReference = () => {
    if (disabled) {
      return
    }
    options.onDeleteReference?.(reference)
    deleteNode()
  }

  const changeUsage = (nextUsage: string) => {
    if (disabled) {
      return
    }
    options.onUsageChange?.(reference, nextUsage)
    updateAttributes({ usage: nextUsage })
  }

  const selectMedia = (url: string, index: number, count: number) => {
    if (disabled || !mediaSelectable) {
      return
    }
    updateAttributes({
      mediaUrl: url,
      mediaIndex: index,
      mediaCount: count,
      mediaItems: [],
    })
  }

  const selectMediaItems = (
    items: ReferenceMediaSelectionItem[],
    count: number
  ) => {
    if (disabled || !mediaSelectable) {
      return
    }
    updateAttributes({
      mediaUrl: '',
      mediaIndex: 0,
      mediaCount: count,
      mediaItems: items,
    })
  }

  return (
    <NodeViewWrapper
      as='span'
      className='reference-node-view'
      contentEditable={false}
      data-drag-handle={disabled ? undefined : ''}
    >
      <ReferenceTag
        label={label}
        alias={alias}
        refType={refType}
        refId={refId}
        trigger={trigger}
        versionId={versionId}
        hint={hint}
        loadPreview={loadPreview}
        selected={selected}
        className='!mx-0'
        disabled={disabled}
        usage={usageSupported ? usage : ''}
        usageOptions={usageOptions}
        mediaURL={String(node.attrs.mediaUrl || '')}
        mediaIndex={Number(node.attrs.mediaIndex || 0)}
        mediaCount={mediaCount}
        mediaItems={mediaItems}
        mediaCapacity={mediaCapacity}
        allowMultiMediaSelection={Boolean(
          mediaSelectable &&
            options.allowMultiMediaSelection &&
            mediaCapacity !== 1
        )}
        onMediaSelect={mediaSelectable ? selectMedia : undefined}
        onMediaItemsSelect={mediaSelectable ? selectMediaItems : undefined}
        onUsageChange={changeUsage}
        onDelete={deleteReference}
      />
    </NodeViewWrapper>
  )
}

function useReferenceNodeMediaAlias(
  editor: NodeViewProps['editor'],
  getPos: NodeViewProps['getPos'],
  enabled: boolean
) {
  const readAlias = useCallback(() => {
    if (!enabled) {
      return ''
    }
    let currentPosition = -1
    try {
      const position = getPos()
      currentPosition = typeof position === 'number' ? position : -1
    } catch {
      return ''
    }
    return referenceMediaAliasAtPosition(editor.state.doc, currentPosition)
  }, [editor, enabled, getPos])
  const [alias, setAlias] = useState(readAlias)

  useEffect(() => {
    const syncAlias = () => setAlias(readAlias())
    syncAlias()
    editor.on('transaction', syncAlias)
    return () => {
      editor.off('transaction', syncAlias)
    }
  }, [editor, readAlias])

  return alias
}

function useReferenceNodeDisabled(editor: NodeViewProps['editor']) {
  const readDisabled = useCallback(() => !editor.isEditable, [editor])
  const [disabled, setDisabled] = useState(readDisabled)

  useEffect(() => {
    const syncDisabled = () => setDisabled(readDisabled())
    syncDisabled()
    editor.on('update', syncDisabled)
    return () => {
      editor.off('update', syncDisabled)
    }
  }, [editor, readDisabled])

  return disabled
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
