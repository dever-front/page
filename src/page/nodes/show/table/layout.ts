import type { CSSProperties } from 'react'
import type { Column } from '@/lib/schema'
import { cn } from '@/lib/utils'

export type FixedColumnLayout = {
  side: 'left' | 'right'
  offset: number
  width: number
}

export function resolveColumnAlign(column: Column) {
  const explicitAlign = String(column.meta?.align || '').trim().toLowerCase()
  if (explicitAlign === 'center' || explicitAlign === 'right' || explicitAlign === 'left') {
    return explicitAlign
  }

  return 'center'
}

export function resolveFixedColumnLayouts(columns: Column[]) {
  const layouts: Array<FixedColumnLayout | null> = Array.from({ length: columns.length }, () => null)
  let leftOffset = 0
  for (let index = 0; index < columns.length; index += 1) {
    const side = resolveFixedColumnSide(columns[index])
    if (side !== 'left') {
      continue
    }

    const width = resolveFixedColumnWidth(columns[index])
    layouts[index] = {
      side,
      offset: leftOffset,
      width,
    }
    leftOffset += width
  }

  let rightOffset = 0
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const side = resolveFixedColumnSide(columns[index])
    if (side !== 'right') {
      continue
    }

    const width = resolveFixedColumnWidth(columns[index])
    layouts[index] = {
      side,
      offset: rightOffset,
      width,
    }
    rightOffset += width
  }

  return layouts
}

export function resolveFixedColumnProps(
  layout: FixedColumnLayout | null,
  type: 'head' | 'body'
) {
  if (!layout) {
    return {
      className: '',
      style: undefined as CSSProperties | undefined,
    }
  }

  const style: CSSProperties = {
    width: layout.width,
    minWidth: layout.width,
    maxWidth: layout.width,
    [layout.side]: layout.offset,
    boxShadow:
      layout.side === 'left'
        ? '10px 0 18px -12px rgb(15 23 42 / 0.28), 1px 0 0 rgb(226 232 240 / 0.9)'
        : '-10px 0 18px -12px rgb(15 23 42 / 0.28), -1px 0 0 rgb(226 232 240 / 0.9)',
  }

  return {
    className: cn(
      'sticky',
      type === 'head' ? 'z-20' : 'z-10',
      layout.side === 'left' ? 'border-r border-border/70' : 'border-l border-border/70'
    ),
    style,
  }
}

export function resolveColumnHeaderClassName(align: string) {
  switch (align) {
    case 'center':
      return 'text-center'
    case 'right':
      return 'text-right'
    default:
      return 'text-left'
  }
}

export function resolveColumnContentClassName(align: string) {
  switch (align) {
    case 'center':
      return 'justify-center text-center'
    case 'right':
      return 'justify-end text-right'
    default:
      return 'justify-start text-left'
  }
}

function resolveFixedColumnSide(column: Column) {
  const side = String(column.meta?.fixed || '')
    .trim()
    .toLowerCase()
  if (side === 'left' || side === 'right') {
    return side
  }
  return ''
}

function resolveFixedColumnWidth(column: Column) {
  const width = Number(column.meta?.width || 0)
  if (Number.isFinite(width) && width > 0) {
    return width
  }
  return 160
}
