import { mergeAttributes, Node } from '@tiptap/core'

export const ReferenceNode = Node.create({
  name: 'reference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      refType: { default: '' },
      refId: { default: 0 },
      label: { default: '' },
      usage: { default: '' },
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
      `@${label}`,
    ]
  },

  renderText({ node }) {
    return `@${String(node.attrs.label || '').trim()}`
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { empty, from } = this.editor.state.selection
        if (!empty) {
          return false
        }
        const nodeBefore = this.editor.state.doc.resolve(from).nodeBefore
        if (nodeBefore?.type.name !== this.name) {
          return false
        }
        return this.editor.commands.deleteRange({
          from: from - nodeBefore.nodeSize,
          to: from,
        })
      },
    }
  },
})
