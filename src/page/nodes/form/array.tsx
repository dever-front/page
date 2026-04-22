import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { loadPageSchema } from '@/lib/request'
import { moveArrayItem } from '@/lib/array'
import { getByPath, setByPath } from '@/lib/path'
import { validatePageSchema, type Item, type PageSchemaType } from '@/lib/schema'
import { useNodeOption } from '@/page/option'
import { FormInput } from './input'
import { FormNumber } from './number'
import { FormPassword } from './password'
import { FormSelect } from './select'
import { FormTextarea } from './textarea'
import { FormEditor } from './editor'
import type { NodeItemProps } from '../../nodes'

const arrayEditorRegistry = {
  'form-input': FormInput,
  'form-number': FormNumber,
  'form-password': FormPassword,
  'form-select': FormSelect,
  'form-textarea': FormTextarea,
  'form-editor': FormEditor,
} as const

type ArrayRowSchema = {
  items: Item[]
  template: Record<string, any>
}

export function FormArray({ item, value, setValue, store }: NodeItemProps) {
  const pageRoute = String(item.meta?.pageRoute || '').trim()
  const layoutId = String(item.meta?.layoutId || '').trim()
  const addText = String(item.meta?.addText || '添加')
  const emptyText = String(item.meta?.emptyText || `暂无${item.name || '数据'}，请点击上方按钮添加。`)
  const dragField = String(item.meta?.drag || '').trim()
  const dragEnabled = dragField === 'sort'
  const rows = useMemo(
    () => normalizeArrayRows(Array.isArray(value) ? value : [], dragEnabled ? dragField : ''),
    [dragEnabled, dragField, value]
  )
  const [rowSchema, setRowSchema] = useState<ArrayRowSchema | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const inheritedPageRoute = buildInheritedFormPageRoute(pageRoute, store)

    async function loadRowSchema() {
      if (!pageRoute) {
        setRowSchema(null)
        setLoadError('未配置 pageRoute')
        return
      }

      setLoading(true)
      setLoadError('')

      try {
        const rawSchema = await loadPageSchema(inheritedPageRoute)
        if (!rawSchema) {
          throw new Error('子表单模板不存在')
        }

        const schema = validatePageSchema(rawSchema)
        const resolved = resolveArrayRowSchema(schema, layoutId)
        if (!cancelled) {
          setRowSchema(resolved)
        }
      } catch (error) {
        if (!cancelled) {
          setRowSchema(null)
          setLoadError(error instanceof Error ? error.message : '子表单模板加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadRowSchema()
    return () => {
      cancelled = true
    }
  }, [layoutId, pageRoute, store])

  const handleAddRow = useCallback(() => {
    const nextTemplate =
      rowSchema?.template != null ? structuredClone(rowSchema.template) : {}
    const nextRows = [...rows, nextTemplate]
    setValue(normalizeArrayRows(nextRows, dragEnabled ? dragField : ''))
  }, [dragEnabled, dragField, rowSchema?.template, rows, setValue])

  const handleRemoveRow = useCallback(
    (index: number) => {
      const nextRows = rows.filter((_, currentIndex) => currentIndex !== index)
      setValue(normalizeArrayRows(nextRows, dragEnabled ? dragField : ''))
    },
    [dragEnabled, dragField, rows, setValue]
  )

  const rowItems = rowSchema?.items ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-md border-dashed bg-background"
          onClick={handleAddRow}
          disabled={loading || !!loadError}
        >
          <Plus className="size-4" />
          {addText}
        </Button>
        <div className="min-h-5 text-xs text-muted-foreground">
          {loading ? '正在加载表格模板...' : loadError || `共 ${rows.length} 个${item.name || '条目'}`}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/15 shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border/70 hover:bg-transparent">
              {dragEnabled ? (
                <TableHead className="h-10 w-[88px] px-4 text-center text-xs font-semibold tracking-wide text-muted-foreground">
                  拖动排序
                </TableHead>
              ) : null}
              {rowItems.map((column) => (
                <TableHead
                  key={column.id}
                  className="h-10 px-4 text-xs font-semibold tracking-wide text-muted-foreground"
                >
                  {column.name || column.placeholder || '字段'}
                </TableHead>
              ))}
              <TableHead className="h-10 w-[88px] px-4 text-center text-xs font-semibold tracking-wide text-muted-foreground">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-background">
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={Math.max(1, rowItems.length + 1 + (dragEnabled ? 1 : 0))}
                  className="px-4 py-7 text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <ArrayFormRow
                  key={getArrayRowKey(row, index)}
                  rowIndex={index}
                  row={row}
                  items={rowItems}
                  store={store}
                  onChange={(nextRow) => {
                    const nextRows = [...rows]
                    nextRows[index] = nextRow
                    setValue(normalizeArrayRows(nextRows, dragEnabled ? dragField : ''))
                  }}
                  onRequestRemove={() => setPendingRemoveIndex(index)}
                  draggable={dragEnabled}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => {
                    if (!dragEnabled) return
                    event.preventDefault()
                  }}
                  onDrop={() => {
                    if (!dragEnabled || dragIndex == null || dragIndex === index) {
                      setDragIndex(null)
                      return
                    }
                    const nextRows = moveArrayItem(rows, dragIndex, index)
                    setValue(normalizeArrayRows(nextRows, dragField))
                    setDragIndex(null)
                  }}
                  onDragEnd={() => setDragIndex(null)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pendingRemoveIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemoveIndex(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">删除头衔</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除这一条头衔吗？删除后当前行内容将被移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoveIndex == null) {
                  return
                }
                handleRemoveRow(pendingRemoveIndex)
                setPendingRemoveIndex(null)
              }}
            >
              确定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ArrayFormRow({
  row,
  rowIndex,
  items,
  store,
  onChange,
  onRequestRemove,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  row: Record<string, any>
  rowIndex: number
  items: Item[]
  store: NodeItemProps['store']
  onChange: (nextRow: Record<string, any>) => void
  onRequestRemove: () => void
  draggable?: boolean
  onDragStart?: () => void
  onDragOver?: (event: DragEvent<HTMLTableRowElement>) => void
  onDrop?: () => void
  onDragEnd?: () => void
}) {
  return (
    <TableRow
      className="border-border/70 hover:bg-transparent"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {draggable ? (
        <TableCell className="px-4 py-3">
          <div className="flex justify-center">
            <button
              type="button"
              className="inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
              aria-label="拖动排序"
            >
              <GripVertical className="size-4" />
            </button>
          </div>
        </TableCell>
      ) : null}
      {items.map((currentItem) => (
        <TableCell key={`${currentItem.id}-${rowIndex}`} className="px-4 py-3">
          <ArrayFormCell
            item={currentItem}
            row={row}
            rowIndex={rowIndex}
            store={store}
            onChange={onChange}
          />
        </TableCell>
      ))}
      <TableCell className="px-4 py-3">
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="rounded-md border border-transparent text-muted-foreground hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
            onClick={onRequestRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function ArrayFormCell({
  item,
  row,
  rowIndex,
  store,
  onChange,
}: {
  item: Item
  row: Record<string, any>
  rowIndex: number
  store: NodeItemProps['store']
  onChange: (nextRow: Record<string, any>) => void
}) {
  const editorType = String(item.type || '').trim()
  const EditorComponent =
    arrayEditorRegistry[editorType as keyof typeof arrayEditorRegistry] || FormInput
  const fieldPath = normalizeArrayFieldPath(item.value)
  const { option, optionLoading, ensureOptionLoaded } = useNodeOption(store, item.option, item)
  const value = fieldPath ? getByPath(row, fieldPath) : undefined
  const setValue = useCallback(
    (nextValue: any) => {
      if (!fieldPath) return
      onChange(setByPath(row, fieldPath, nextValue))
    },
    [fieldPath, onChange, row]
  )

  const cellItem = useMemo<Item>(
    () => ({
      ...item,
      id: `${item.id || 'array-item'}-${rowIndex}`,
      mode: undefined,
      className: cn('w-full', item.className),
      meta: {
        ...item.meta,
        formLayout: undefined,
        controlClassName: cn(
          'h-9 w-full min-w-[11rem] rounded-lg bg-background shadow-none',
          item.meta?.controlClassName
        ),
      },
    }),
    [item, rowIndex]
  )

  return (
    <EditorComponent
      item={cellItem}
      value={value}
      setValue={setValue}
      option={option}
      optionLoading={optionLoading}
      ensureOptionLoaded={ensureOptionLoaded}
      runAction={async () => {}}
      store={store}
      layoutId=""
    />
  )
}

function buildInheritedFormPageRoute(route: string, store: NodeItemProps['store']) {
  const currentRoute = String(route || '').trim()
  if (!currentRoute) {
    return ''
  }

  const [pathname, rawQuery = ''] = currentRoute.split('?')
  const searchParams = new URLSearchParams(rawQuery)
  const parentRoute = String(store.getState().pagePath || store.getState().schema.page?.route || '')
  const [parentPath, parentRawQuery = ''] = parentRoute.split('?')
  const normalizedParentPath = parentPath.replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
  if (!normalizedParentPath) {
    return currentRoute
  }

  searchParams.set('_inherit', 'form')
  searchParams.set('_parentPath', normalizedParentPath)

  for (const [key, value] of new URLSearchParams(parentRawQuery).entries()) {
    appendParentQueryValue(searchParams, key, value)
  }

  const routeQuery = store.getState().state?.route?.query
  if (routeQuery && typeof routeQuery === 'object' && !Array.isArray(routeQuery)) {
    for (const [key, value] of Object.entries(routeQuery)) {
      appendParentQueryValue(searchParams, key, value)
    }
  }

  const queryString = searchParams.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

function appendParentQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: unknown
) {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey || value == null || value === '') {
    return
  }

  const targetKey = `_parent_${normalizedKey}`
  searchParams.delete(targetKey)

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item != null && String(item).trim() !== '') {
        searchParams.append(targetKey, String(item))
      }
    }
    return
  }

  searchParams.set(targetKey, String(value))
}

function resolveArrayRowSchema(schema: PageSchemaType, layoutId?: string): ArrayRowSchema {
  const layoutItems =
    (layoutId && schema.nodes?.[layoutId]) ||
    Object.values(schema.nodes ?? {}).find((items) => Array.isArray(items) && items.length > 0) ||
    []

  if (!layoutItems.length) {
    throw new Error('子表单模板没有可用字段')
  }

  const formTemplate =
    schema.data?.form && typeof schema.data.form === 'object'
      ? structuredClone(schema.data.form)
      : buildArrayTemplate(layoutItems)

  return {
    items: layoutItems,
    template: formTemplate,
  }
}

function buildArrayTemplate(items: Item[]) {
  let result: Record<string, any> = {}
  for (const item of items) {
    const fieldPath = normalizeArrayFieldPath(item.value)
    if (!fieldPath) {
      continue
    }
    result = setByPath(result, fieldPath, item.meta?.multiple ? [] : '')
  }
  return result
}

function normalizeArrayFieldPath(path?: string) {
  const value = String(path || '').trim()
  if (!value) {
    return ''
  }
  if (value === 'form') {
    return ''
  }
  if (value.startsWith('form.')) {
    return value.slice(5)
  }
  if (value.startsWith('data.form.')) {
    return value.slice(10)
  }
  return value
}

function getArrayRowKey(row: Record<string, any>, index: number) {
  const id = row?.id
  if (id != null && id !== '') {
    return String(id)
  }
  return `row-${index}`
}

function normalizeArrayRows(rows: Record<string, any>[], sortField: string) {
  const nextRows = rows.map((row) => structuredClone(row ?? {}))
  if (!sortField) {
    return nextRows
  }

  return nextRows.map((row, index) => {
    row[sortField] = index + 1
    return row
  })
}
