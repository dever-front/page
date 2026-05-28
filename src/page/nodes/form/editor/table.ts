import { mergeAttributes, Node } from '@tiptap/react'

function parseSpan(value: string | null) {
  const span = Number(value || 1)
  return Number.isFinite(span) && span > 0 ? span : 1
}

function createCellAttributes() {
  return {
    colspan: {
      default: 1,
      parseHTML: (element: HTMLElement) => parseSpan(element.getAttribute('colspan')),
    },
    rowspan: {
      default: 1,
      parseHTML: (element: HTMLElement) => parseSpan(element.getAttribute('rowspan')),
    },
  }
}

export const editorTableExtensions = [
  Node.create({
    name: 'table',
    group: 'block',
    content: 'tableRow+',
    isolating: true,
    parseHTML() {
      return [
        { tag: 'table', contentElement: 'tbody' },
        { tag: 'table' },
      ]
    },
    renderHTML({ HTMLAttributes }) {
      return ['table', mergeAttributes(HTMLAttributes), ['tbody', 0]]
    },
  }),
  Node.create({
    name: 'tableRow',
    content: '(tableCell | tableHeader)+',
    parseHTML() {
      return [{ tag: 'tr' }]
    },
    renderHTML({ HTMLAttributes }) {
      return ['tr', mergeAttributes(HTMLAttributes), 0]
    },
  }),
  Node.create({
    name: 'tableCell',
    content: 'block+',
    isolating: true,
    addAttributes() {
      return createCellAttributes()
    },
    parseHTML() {
      return [{ tag: 'td' }]
    },
    renderHTML({ HTMLAttributes }) {
      return ['td', mergeAttributes(HTMLAttributes), 0]
    },
  }),
  Node.create({
    name: 'tableHeader',
    content: 'block+',
    isolating: true,
    addAttributes() {
      return createCellAttributes()
    },
    parseHTML() {
      return [{ tag: 'th' }]
    },
    renderHTML({ HTMLAttributes }) {
      return ['th', mergeAttributes(HTMLAttributes), 0]
    },
  }),
]
