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
import { loadPageSchema, request } from '@/lib/request'
import { moveArrayItem } from '@/lib/array'
import { getByPath, setByPath } from '@/lib/path'
import { applyOptionFilters } from '@/lib/option-filter'
import { resolveOptionParams } from '@/lib/option-params'
import {
  isSameControlValue,
  normalizeClearOnChangePaths,
  normalizeFormRowFieldPath,
} from '@/lib/form-control'
import { validatePageSchema, type Item, type PageSchemaType } from '@/lib/schema'
import { useStorePathValue } from '@/lib/store'
import { useNodeOption } from '@/page/option'
import { FormInput } from './input'
import { FormNumber } from './number'
import { FormPassword } from './password'
import { FormSelect } from './select'
import { FormSwitch } from './switch'
import { FormRadio } from './radio'
import { FormCheckbox } from './checkbox'
import { FormCascader } from './cascader'
import { FormTextarea } from './textarea'
import { FormEditor } from './editor'
import { InlineTip } from '../show/tooltip'
import type { NodeItemProps } from '../../nodes'

const arrayEditorRegistry = {
  'form-input': FormInput,
  'form-number': FormNumber,
  'form-password': FormPassword,
  'form-select': FormSelect,
  'form-switch': FormSwitch,
  'form-radio': FormRadio,
  'form-checkbox': FormCheckbox,
  'form-cascader': FormCascader,
  'form-textarea': FormTextarea,
  'form-editor': FormEditor,
} as const

type ArrayRowSchema = {
  items: Item[]
  template: Record<string, any>
}

type FallbackRowsConfig = {
  source: string
  path: string
  targetField: string
  valueField: string
  skipFirst: boolean
  defaultRow: Record<string, any>
}

export function FormArray({ item, value, setValue, store }: NodeItemProps) {
  const pageRoute = String(item.meta?.pageRoute || '').trim()
  const layoutId = String(item.meta?.layoutId || '').trim()
  const addText = String(item.meta?.addText || '添加')
  const itemLabel = resolveArrayItemLabel(item, addText)
  const emptyText = String(item.meta?.emptyText || `暂无${item.name || '数据'}，请点击上方按钮添加。`)
  const dragField = String(item.meta?.drag || '').trim()
  const dragEnabled = dragField === 'sort'
  const outputFormat = String(item.meta?.valueFormat || '').trim().toLowerCase()
  const fillConfig = useMemo(() => normalizeFillFromOptionConfig(item.meta?.fillFromOption), [item.meta?.fillFromOption])
  const fallbackRowsConfig = useMemo(
    () => normalizeFallbackRowsConfig(item.meta?.fallbackRows),
    [item.meta?.fallbackRows]
  )
  const fallbackRowsSourceValue = useStorePathValue(store, fallbackRowsConfig?.source)
  const sortField = dragEnabled ? dragField : ''
  const inheritedPageRoute = useMemo(
    () => buildInheritedFormPageRoute(pageRoute, store),
    [pageRoute, store]
  )
  const rows = useMemo(
    () => normalizeArrayRows(
      resolveArrayInputRows(value, fallbackRowsConfig, fallbackRowsSourceValue),
      sortField
    ),
    [fallbackRowsConfig, fallbackRowsSourceValue, sortField, value]
  )
  const [rowSchema, setRowSchema] = useState<ArrayRowSchema | null>(null)
  const [loading, setLoading] = useState(false)
  const [fillLoading, setFillLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null)
  const clearOnChangePaths = useMemo(
    () => normalizeClearOnChangePaths(item.meta?.clearOnChange),
    [item.meta?.clearOnChange]
  )
  const commitRows = useCallback(
    (nextRows: Record<string, any>[]) => {
      const normalizedRows = normalizeArrayRows(nextRows, sortField)
      setValue(formatArrayOutputValue(normalizedRows, outputFormat))
      for (const path of clearOnChangePaths) {
        if (path !== item.value) {
          store.getState().setValueByPath(path, '')
        }
      }
    },
    [clearOnChangePaths, item.value, outputFormat, setValue, sortField, store]
  )

  useEffect(() => {
    let cancelled = false

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
  }, [inheritedPageRoute, layoutId, pageRoute])

  const buildTemplateRow = useCallback(() => {
    const nextTemplate: Record<string, any> =
      rowSchema?.template != null ? structuredClone(rowSchema.template) : {}
    return nextTemplate
  }, [rowSchema?.template])

  const appendOptionRows = useCallback(
    async (all: boolean) => {
      if (!fillConfig) {
        commitRows([...rows, buildTemplateRow()])
        return
      }

      setFillLoading(true)
      try {
        const options = await loadFillOptions(fillConfig, store)
        const existingValues = new Set(
          rows.map((row) => String(getByPath(row, fillConfig.targetField) ?? '')).filter(Boolean)
        )
        const missingOptions = options.filter((option) => {
          const value = String(getByPath(option, fillConfig.valueField) ?? '').trim()
          return value !== '' && !existingValues.has(value)
        })
        const pickedOptions = all ? missingOptions : missingOptions.slice(0, 1)
        if (!pickedOptions.length) {
          return
        }
        const nextRows = pickedOptions.map((option) => ({
          ...buildTemplateRow(),
          ...fillConfig.defaultRow,
          [fillConfig.targetField]: String(getByPath(option, fillConfig.valueField) ?? '').trim(),
        }))
        commitRows([...rows, ...nextRows])
      } finally {
        setFillLoading(false)
      }
    },
    [buildTemplateRow, commitRows, fillConfig, rows, store]
  )

  const handleAddRow = useCallback(() => {
    void appendOptionRows(false)
  }, [appendOptionRows])

  const handleAddAllRows = useCallback(() => {
    void appendOptionRows(true)
  }, [appendOptionRows])

  const handleRemoveRow = useCallback(
    (index: number) => {
      commitRows(rows.filter((_, currentIndex) => currentIndex !== index))
    },
    [commitRows, rows]
  )

  const rowItems = rowSchema?.items ?? []

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-md border-dashed bg-background"
          onClick={handleAddRow}
          disabled={loading || fillLoading || !!loadError}
        >
          <Plus className="size-4" />
          {fillLoading ? '正在添加...' : addText}
        </Button>
        {fillConfig && item.meta?.addAllText !== false ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-md border-dashed bg-background"
            onClick={handleAddAllRows}
            disabled={loading || fillLoading || !!loadError}
          >
            <Plus className="size-4" />
            {String(item.meta?.addAllText || '添加全部')}
          </Button>
        ) : null}
        {(item.meta?.clearText || item.meta?.clearable === true) ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-md bg-background"
            onClick={() => commitRows([])}
            disabled={loading || fillLoading || rows.length === 0}
          >
            {String(item.meta?.clearText || '清空')}
          </Button>
        ) : null}
        <div className="ml-1 min-h-5 text-xs text-muted-foreground">
          {loading ? '正在加载表格模板...' : loadError || `共 ${rows.length} 个${item.name || '条目'}`}
        </div>
      </div>

      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-border/70 bg-muted/15 shadow-xs">
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
                  <span className="inline-flex items-center gap-1.5">
                    <span>{column.name || column.placeholder || '字段'}</span>
                    <InlineTip content={String(column.tip || column.info || '')} />
                  </span>
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
                    commitRows(nextRows)
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
                    commitRows(nextRows)
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
            <AlertDialogTitle className="text-base">删除{itemLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除这一条{itemLabel}吗？删除后当前行内容将被移除。
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

function resolveArrayItemLabel(item: Item, addText: string) {
  const metaName = String(item.meta?.itemName || item.meta?.label || '').trim()
  if (metaName) {
    return metaName
  }

  const itemName = String(item.name || '').trim()
  if (itemName) {
    return itemName
  }

  const normalizedAddText = String(addText || '').trim().replace(/^(添加|新增|新建|增加)/, '')
  return normalizedAddText || '条目'
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
      onDragOver={draggable ? onDragOver : undefined}
      onDrop={draggable ? onDrop : undefined}
    >
      {draggable ? (
        <TableCell className="px-4 py-3">
          <div className="flex justify-center">
            <button
              type="button"
              draggable={draggable}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
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
  const fieldPath = normalizeFormRowFieldPath(item.value, {
    allowDataForm: true,
    allowScoped: true,
  })
  const { option, optionLoading, ensureOptionLoaded } = useNodeOption(store, item.option, item, row)
  const rowScopedOption = useMemo(() => {
    const state = store.getState()
    return applyOptionFilters(option, item, {
      data: {
        ...state.data,
        row,
      },
      state: state.state,
      optionRegistry: state.optionRegistry,
    })
  }, [item, option, row, store])
  const value = fieldPath ? getByPath(row, fieldPath) : undefined
  const setValue = useCallback(
    (nextValue: any) => {
      if (!fieldPath) return
      const previousValue = getByPath(row, fieldPath)
      let nextRow = setByPath(row, fieldPath, nextValue)
      if (!isSameControlValue(previousValue, nextValue)) {
        for (const path of normalizeClearOnChangePaths(item.meta?.clearOnChange)) {
          const rowPath = normalizeFormRowFieldPath(path, {
            allowDataForm: true,
            allowScoped: true,
          })
          nextRow = rowPath ? setByPath(nextRow, rowPath, '') : nextRow
        }
      }
      onChange(nextRow)
    },
    [fieldPath, item.meta?.clearOnChange, onChange, row]
  )

  useEffect(() => {
    if (value == null || value === '') {
      return
    }
    void ensureOptionLoaded?.(undefined, value)
  }, [ensureOptionLoaded, value])

  const cellItem = useMemo<Item>(
    () => ({
      ...item,
      id: `${item.id || 'array-item'}-${rowIndex}`,
      mode: undefined,
      className: cn('w-full', item.className),
      meta: {
        ...item.meta,
        formLayout: undefined,
        wrap: item.meta?.wrap ?? (editorType === 'form-cascader' ? false : undefined),
        controlClassName: cn(
          resolveArrayCellControlClassName(editorType),
          item.meta?.controlClassName
        ),
      },
    }),
    [editorType, item, rowIndex]
  )

  return (
    <EditorComponent
      item={cellItem}
      value={value}
      setValue={setValue}
      option={rowScopedOption}
      optionLoading={optionLoading}
      ensureOptionLoaded={ensureOptionLoaded}
      runAction={async () => {}}
      store={store}
      layoutId=""
      row={row}
      setRow={onChange}
    />
  )
}

function resolveArrayCellControlClassName(editorType: string) {
  const base = 'h-9 rounded-lg bg-background shadow-none'
  if (editorType === 'form-cascader') {
    return `${base} w-[12rem] min-w-[10rem]`
  }
  return `${base} w-full min-w-[11rem]`
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

  const items = applyChildSchemaOptions(layoutItems, schema)
  const formTemplate =
    schema.data?.form && typeof schema.data.form === 'object'
      ? structuredClone(schema.data.form)
      : buildArrayTemplate(items)

  return {
    items,
    template: formTemplate,
  }
}

function applyChildSchemaOptions(items: Item[], schema: PageSchemaType) {
  return items.map((item) => {
    if (typeof item.option !== 'string' || isRemoteOptionSource(item.option)) {
      return item
    }

    const options = getByPath(schema.data ?? {}, item.option)
    if (!Array.isArray(options)) {
      return item
    }

    return {
      ...item,
      option: structuredClone(options),
    }
  })
}

function buildArrayTemplate(items: Item[]) {
  let result: Record<string, any> = {}
  for (const item of items) {
    const fieldPath = normalizeFormRowFieldPath(item.value, {
      allowDataForm: true,
      allowScoped: true,
    })
    if (!fieldPath) {
      continue
    }
    result = setByPath(result, fieldPath, defaultArrayFieldValue(item))
  }
  return result
}

function defaultArrayFieldValue(item: Item) {
  if (item.meta?.multiple) {
    return []
  }
  if (item.type === 'form-switch') {
    return item.meta?.trueValue ?? true
  }
  return ''
}

function isRemoteOptionSource(optionConfig: string) {
  const normalized = optionConfig.trim()
  return normalized.startsWith('/') || /^https?:\/\//i.test(normalized)
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

function formatArrayOutputValue(rows: Record<string, any>[], outputFormat: string) {
  if (outputFormat === 'json') {
    return JSON.stringify(rows)
  }
  return rows
}

type FillFromOptionConfig = {
  source: string
  targetField: string
  valueField: string
  defaultRow: Record<string, any>
  params?: Record<string, any>
}

function normalizeFillFromOptionConfig(value: unknown): FillFromOptionConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const raw = value as Record<string, any>
  const source = String(raw.source || '').trim()
  const targetField = String(raw.targetField || raw.field || '').trim()
  if (!source || !targetField) {
    return null
  }
  return {
    source,
    targetField,
    valueField: String(raw.valueField || 'id').trim() || 'id',
    defaultRow: raw.defaultRow && typeof raw.defaultRow === 'object' && !Array.isArray(raw.defaultRow)
      ? raw.defaultRow
      : {},
    params: raw.params && typeof raw.params === 'object' && !Array.isArray(raw.params)
      ? raw.params
      : undefined,
  }
}

function normalizeFallbackRowsConfig(value: unknown): FallbackRowsConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const raw = value as Record<string, any>
  const source = String(raw.source || '').trim()
  const targetField = String(raw.targetField || raw.field || '').trim()
  if (!source || !targetField) {
    return null
  }

  return {
    source,
    path: String(raw.path || '').trim(),
    targetField,
    valueField: String(raw.valueField || '').trim(),
    skipFirst: raw.skipFirst === true,
    defaultRow: raw.defaultRow && typeof raw.defaultRow === 'object' && !Array.isArray(raw.defaultRow)
      ? raw.defaultRow
      : {},
  }
}

function resolveArrayInputRows(
  value: unknown,
  fallbackConfig: FallbackRowsConfig | null,
  fallbackSourceValue: unknown
) {
  const rows = normalizeArrayInput(value)
  if (rows.length > 0) {
    return rows
  }
  return normalizeFallbackRows(fallbackConfig, fallbackSourceValue)
}

function normalizeFallbackRows(
  config: FallbackRowsConfig | null,
  sourceValue: unknown
): Record<string, any>[] {
  if (!config) {
    return []
  }

  const source = decodeFallbackSourceValue(sourceValue)
  const rawItems = config.path ? getByPath(source, config.path) : source
  const items = Array.isArray(rawItems) ? rawItems : []
  const selectedItems = config.skipFirst ? items.slice(1) : items

  return selectedItems
    .map((item) => fallbackRowFromItem(config, item))
    .filter(isArrayRow)
}

function fallbackRowFromItem(config: FallbackRowsConfig, item: unknown) {
  const value = resolveFallbackRowValue(config, item)
  if (value == null || String(value).trim() === '') {
    return null
  }

  return {
    ...config.defaultRow,
    [config.targetField]: value,
  }
}

function resolveFallbackRowValue(config: FallbackRowsConfig, item: unknown) {
  if (config.valueField && item && typeof item === 'object' && !Array.isArray(item)) {
    return getByPath(item, config.valueField)
  }
  return item
}

function decodeFallbackSourceValue(value: unknown) {
  if (value && typeof value === 'object') {
    return value
  }

  const text = String(value ?? '').trim()
  if (!text || (text[0] !== '{' && text[0] !== '[')) {
    return value
  }

  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

async function loadFillOptions(config: FillFromOptionConfig, store: NodeItemProps['store']) {
  if (isRemoteOptionSource(config.source)) {
    const params = resolveOptionParams(config.params, { store })
    if (config.params && Object.keys(params).length < Object.keys(config.params).length) {
      return []
    }
    const result = await request(
      config.source,
      'get',
      params
    )
    return Array.isArray(result.data) ? result.data as Record<string, any>[] : []
  }

  const value = store.getState().getValueByPath(config.source)
  return Array.isArray(value) ? value as Record<string, any>[] : []
}

function normalizeArrayInput(value: any): Record<string, any>[] {
  if (Array.isArray(value)) {
    return value.filter(isArrayRow)
  }
  if (typeof value !== 'string') {
    return []
  }

  const text = value.trim()
  if (!text.startsWith('[')) {
    return []
  }

  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.filter(isArrayRow) : []
  } catch {
    return []
  }
}

function isArrayRow(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
