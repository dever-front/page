import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ReferenceNodeView } from './reference-node-view'
import type {
  ReferencePart,
  ReferencePreviewLoader,
  ReferenceUsageOption,
} from './types'

export type ReferenceNodeOptions = {
  loadPreview?: ReferencePreviewLoader
  usageOptions?: ReferenceUsageOption[]
  onDeleteReference?: (
    reference: Extract<ReferencePart, { type: 'reference' }>
  ) => void
  onUsageChange?: (
    reference: Extract<ReferencePart, { type: 'reference' }>,
    usage: string
  ) => void
}

export const ReferenceNode = Node.create<ReferenceNodeOptions>({
  name: 'reference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      loadPreview: undefined,
      usageOptions: [],
      onDeleteReference: undefined,
      onUsageChange: undefined,
    }
  },

  addAttributes() {
    return {
      refType: { default: '' },
      refId: { default: 0 },
      label: { default: '' },
      usage: { default: '' },
      trigger: { default: '@' },
      versionId: { default: 0 },
      previewText: { default: '' },
      previewKind: { default: '' },
      previewUrl: { default: '' },
      origin: { default: '' },
      originId: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-reference]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const label = String(HTMLAttributes.label || '').trim()
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-reference': '',
        contenteditable: 'false',
      }),
      label,
    ]
  },

  renderText({ node }) {
    const trigger = String(node.attrs.trigger || '@').trim() || '@'
    const label = String(node.attrs.label || '').trim().replace(/^[@#]/, '')
    return `${trigger}${label}`
  },

  addNodeView() {
    return ReactNodeViewRenderer(ReferenceNodeView)
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        if (!this.editor.isEditable) {
          return false
        }
        const { empty, from, $from } = this.editor.state.selection
        if (!empty) {
          return false
        }
        const nodeBefore = $from.nodeBefore
        if (nodeBefore?.type.name === this.name) {
          this.options.onDeleteReference?.(
            referencePartFromAttributes(nodeBefore.attrs)
          )
          return this.editor.commands.deleteRange({
            from: from - nodeBefore.nodeSize,
            to: from,
          })
        }
        if (!nodeBefore?.isText || !/\s$/.test(nodeBefore.textContent)) {
          return false
        }

        const spacerStart = from - 1
        const referenceBefore = this.editor.state.doc.resolve(spacerStart)
          .nodeBefore
        if (referenceBefore?.type.name !== this.name) {
          return false
        }
        this.options.onDeleteReference?.(
          referencePartFromAttributes(referenceBefore.attrs)
        )
        let deleteFrom = spacerStart - referenceBefore.nodeSize
        const parentStart = $from.start()
        if (
          deleteFrom === parentStart + 1 &&
          /^\s$/.test(
            this.editor.state.doc.textBetween(parentStart, deleteFrom)
          )
        ) {
          deleteFrom = parentStart
        }
        return this.editor.commands.deleteRange({
          from: deleteFrom,
          to: from,
        })
      },
    }
  },
})

export function referencePartFromAttributes(
  attrs: Record<string, unknown>
): Extract<ReferencePart, { type: 'reference' }> {
  const versionID = Number(attrs.versionId || 0)
  return {
    type: 'reference',
    ref_type: referenceTypeFromValue(attrs.refType),
    ref_id: Number(attrs.refId || 0),
    label: String(attrs.label || '').trim(),
    usage: String(attrs.usage || '').trim() || undefined,
    ref_trigger: String(attrs.trigger || '').trim() || undefined,
    ref_version_id: versionID > 0 ? versionID : undefined,
    ref_origin: String(attrs.origin || '').trim() || undefined,
    ref_origin_id: String(attrs.originId || '').trim() || undefined,
  }
}

export function referenceTypeFromValue(value: unknown): Extract<
  ReferencePart,
  { type: 'reference' }
>['ref_type'] {
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
