import { mergeAttributes, Node } from '@tiptap/react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    richTextTable: {
      insertRichTextTable: (options?: {
        rows?: number
        cols?: number
        withHeaderRow?: boolean
      }) => ReturnType
      addRichTextTableRowAfter: () => ReturnType
      addRichTextTableColumnAfter: () => ReturnType
      deleteRichTextTableRow: () => ReturnType
      deleteRichTextTableColumn: () => ReturnType
      deleteRichTextTable: () => ReturnType
    }
  }
}

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
    addCommands() {
      return {
        insertRichTextTable:
          (options = {}) =>
          ({ commands, state }: any) => {
            const rows = clampTableSize(options.rows, 2)
            const cols = clampTableSize(options.cols, 2)
            const table = createTableNode(
              state.schema,
              rows,
              cols,
              options.withHeaderRow !== false
            )
            return table ? commands.insertContent(table.toJSON()) : false
          },
        ...createRowCommands(),
        ...createColumnCommands(),
        deleteRichTextTable:
          () =>
          ({ dispatch, state }: any) => {
            const context = findTableContext(state)
            if (!context) {
              return false
            }
            dispatch?.(
              state.tr.delete(
                context.tablePos,
                context.tablePos + context.tableNode.nodeSize
              )
            )
            return true
          },
      }
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

function createRowCommands() {
  return {
    addRichTextTableRowAfter:
      () =>
      ({ dispatch, state }: any) => {
        const context = findTableContext(state)
        if (!context) {
          return false
        }
        const row = createRowNode(
          state.schema,
          Math.max(context.rowNode.childCount, 1),
          false
        )
        if (!row) {
          return false
        }
        dispatch?.(state.tr.insert(context.rowPos + context.rowNode.nodeSize, row))
        return true
      },
    deleteRichTextTableRow:
      () =>
      ({ dispatch, state }: any) => {
        const context = findTableContext(state)
        if (!context) {
          return false
        }
        const tr =
          context.tableNode.childCount <= 1
            ? state.tr.delete(context.tablePos, context.tablePos + context.tableNode.nodeSize)
            : state.tr.delete(context.rowPos, context.rowPos + context.rowNode.nodeSize)
        dispatch?.(tr)
        return true
      },
  }
}

function createColumnCommands() {
  return {
    addRichTextTableColumnAfter:
      () =>
      ({ dispatch, state }: any) => {
        const context = findTableContext(state)
        if (!context) {
          return false
        }

        const inserts: Array<{ pos: number; node: any }> = []
        context.tableNode.forEach((rowNode: any, rowOffset: number, rowIndex: number) => {
          const rowStart = context.tableStart + rowOffset
          const insertIndex = Math.min(context.cellIndex + 1, rowNode.childCount)
          const cellType = resolveNewCellType(state.schema, rowNode, rowIndex)
          const cell = createCellNode(cellType)
          if (!cell) {
            return
          }
          inserts.push({
            pos: rowStart + 1 + cellOffset(rowNode, insertIndex),
            node: cell,
          })
        })

        if (inserts.length === 0) {
          return false
        }

        const tr = inserts
          .sort((a, b) => b.pos - a.pos)
          .reduce((currentTr, current) => currentTr.insert(current.pos, current.node), state.tr)
        dispatch?.(tr)
        return true
      },
    deleteRichTextTableColumn:
      () =>
      ({ dispatch, state }: any) => {
        const context = findTableContext(state)
        if (!context) {
          return false
        }

        const deletes: Array<{ from: number; to: number }> = []
        context.tableNode.forEach((rowNode: any, rowOffset: number) => {
          if (rowNode.childCount <= context.cellIndex) {
            return
          }
          const rowStart = context.tableStart + rowOffset
          const from = rowStart + 1 + cellOffset(rowNode, context.cellIndex)
          deletes.push({ from, to: from + rowNode.child(context.cellIndex).nodeSize })
        })

        if (deletes.length === 0) {
          return false
        }

        const tr =
          context.rowNode.childCount <= 1
            ? state.tr.delete(
                context.tablePos,
                context.tablePos + context.tableNode.nodeSize
              )
            : deletes
                .sort((a, b) => b.from - a.from)
                .reduce(
                  (currentTr, current) => currentTr.delete(current.from, current.to),
                  state.tr
                )
        dispatch?.(tr)
        return true
      },
  }
}

function clampTableSize(value: unknown, fallback: number) {
  const size = Number(value)
  if (!Number.isFinite(size)) {
    return fallback
  }
  return Math.max(1, Math.min(12, Math.round(size)))
}

function createTableNode(
  schema: any,
  rows: number,
  cols: number,
  withHeaderRow: boolean
) {
  const tableType = schema.nodes.table
  const rowType = schema.nodes.tableRow
  if (!tableType || !rowType) {
    return null
  }

  const rowNodes = Array.from({ length: rows }, (_, rowIndex) =>
    createRowNode(schema, cols, withHeaderRow && rowIndex === 0)
  ).filter(Boolean)

  return tableType.create(null, rowNodes)
}

function createRowNode(schema: any, cols: number, header: boolean) {
  const rowType = schema.nodes.tableRow
  const cellType = header ? schema.nodes.tableHeader : schema.nodes.tableCell
  if (!rowType || !cellType) {
    return null
  }

  return rowType.create(
    null,
    Array.from({ length: cols }, () => createCellNode(cellType)).filter(Boolean)
  )
}

function createCellNode(cellType: any) {
  if (!cellType) {
    return null
  }
  return cellType.createAndFill()
}

function resolveNewCellType(schema: any, rowNode: any, rowIndex: number) {
  const firstCell = rowNode.childCount > 0 ? rowNode.child(0) : null
  if (firstCell?.type?.name === 'tableHeader' || rowIndex === 0) {
    return schema.nodes.tableHeader || schema.nodes.tableCell
  }
  return schema.nodes.tableCell
}

function findTableContext(state: any) {
  const { $from } = state.selection
  let cellDepth = -1
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name
    if (name === 'tableCell' || name === 'tableHeader') {
      cellDepth = depth
      break
    }
  }

  if (cellDepth < 2) {
    return null
  }

  const rowDepth = cellDepth - 1
  const tableDepth = cellDepth - 2
  if ($from.node(rowDepth).type.name !== 'tableRow') {
    return null
  }
  if ($from.node(tableDepth).type.name !== 'table') {
    return null
  }

  return {
    tableNode: $from.node(tableDepth),
    rowNode: $from.node(rowDepth),
    tablePos: $from.before(tableDepth),
    tableStart: $from.start(tableDepth),
    rowPos: $from.before(rowDepth),
    cellIndex: $from.index(rowDepth),
  }
}

function cellOffset(rowNode: any, index: number) {
  let offset = 0
  for (let current = 0; current < index && current < rowNode.childCount; current += 1) {
    offset += rowNode.child(current).nodeSize
  }
  return offset
}
