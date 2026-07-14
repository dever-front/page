import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ReferenceNodeView } from './reference-node-view'
import type { ReferencePreviewLoader } from './types'

export type ReferenceNodeOptions = {
  loadPreview?: ReferencePreviewLoader
}

export const ReferenceNode = Node.create<ReferenceNodeOptions>({
  name: 'reference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { loadPreview: undefined }
  },

  addAttributes() {
    return {
      refType: { default: '' },
      refId: { default: 0 },
      label: { default: '' },
      usage: { default: '' },
      previewText: { default: '' },
      previewKind: { default: '' },
      previewUrl: { default: '' },
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
    return String(node.attrs.label || '').trim()
  },

  addNodeView() {
    return ReactNodeViewRenderer(ReferenceNodeView)
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { empty, from, $from } = this.editor.state.selection
        if (!empty) {
          return false
        }
        const nodeBefore = $from.nodeBefore
        if (nodeBefore?.type.name === this.name) {
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
