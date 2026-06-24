/**
 * Show/Table.tsx - 表格展示
 * 使用 shadcn/ui Table 组件
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight, X } from 'lucide-react'
import { useStore } from 'zustand'
import { runActions } from '@/lib/action'
import { resolveLucideIcon } from '@/lib/icon'
import {
  buildStoreBackNavigationHref,
  withBackNavigationSearch,
} from '@/lib/navigation'
import { getByPath } from '@/lib/path'
import { stripRouterBasePath } from '@/lib/router-path'
import type { Column } from '@/lib/schema'
import { getStoreValueByPath, useStorePathValue } from '@/lib/store'
import { cn, formatDisplayValue } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { NodeItemProps } from '../../nodes'
import { MediaAudio } from '../media/audio'
import { MediaFileList } from '../media/file-list'
import { MediaImage } from '../media/image'
import { MediaVideo } from '../media/video'
import { ShowDate } from './date'
import { ShowRich } from './rich'
import { ShowSelect } from './select'
import { ActionButton } from './shared/action-button'
import { ShowStatus } from './status'
import {
  EditableFormCell,
  EditableShowCell,
  applyInlineRowPatch,
  applyInlineRowPatchByIndex,
  buildInlineChangeAction,
  canUseInlineEdit,
} from './table/inline-edit'
import {
  resolveColumnAlign,
  resolveColumnContentClassName,
  resolveColumnHeaderClassName,
  resolveFixedColumnLayouts,
  resolveFixedColumnProps,
} from './table/layout'
import { resolveColumnOptionList } from './table/options'
import { ShowTag } from './tag'
import { InlineTip } from './tooltip'

export function ShowTable({ item, value, runAction, store }: NodeItemProps) {
  const navigate = useNavigate()
  const columns: Column[] = item.meta?.columns || []
  const data: any[] = Array.isArray(value) ? value : []
  const rowKey = item.meta?.rowKey || 'id'
  const fixedColumnLayouts = useMemo(
    () => resolveFixedColumnLayouts(columns),
    [columns]
  )
  const isRemote = item.meta?.remote === true
  const searchKeyword = useTableStoreValue(store, item.meta?.searchPath)
  const extraFilters = useTableFilters(store, item.meta?.filters)
  const currentPage = Number(
    useTableStoreValue(store, item.meta?.pagePath) ?? 1
  )
  const pageSize = Number(
    useTableStoreValue(store, item.meta?.pageSizePath) ?? 10
  )
  const totalValue = Number(
    useTableStoreValue(store, item.meta?.totalPath) ?? data.length
  )
  const treeMode = item.meta?.tree === true
  const treeParentKey = String(item.meta?.parentKey || 'parent_id')
  const treeLabelField = String(item.meta?.treeLabelField || 'name')
  const selectable = !!item.meta?.selectable
  const bulkActions = Array.isArray(item.meta?.bulkActions)
    ? item.meta.bulkActions
    : []
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string>>([])
  const [collapsedRowKeys, setCollapsedRowKeys] = useState<Array<string>>([])
  const selectedRowKeySet = useMemo(
    () => new Set(selectedRowKeys),
    [selectedRowKeys]
  )
  const selectedRows = useMemo(
    () => data.filter((row) => selectedRowKeySet.has(String(row[rowKey]))),
    [data, rowKey, selectedRowKeySet]
  )

  const handleAction = useCallback(
    async (actionName: string) => {
      await runAction(actionName)
    },
    [runAction]
  )

  const filteredData = useMemo(() => {
    if (isRemote) {
      return data
    }

    const keyword = String(searchKeyword ?? '')
      .trim()
      .toLowerCase()

    const searchableColumns = columns.filter((col) => col.value)
    return data.filter((row) => {
      const matchesKeyword =
        !keyword ||
        searchableColumns.some((col) =>
          String(getByPath(row, col.value as string) ?? '')
            .toLowerCase()
            .includes(keyword)
        )

      const matchesFilters = extraFilters.every((filter) => {
        if (!filter.value || filter.value === '__all__') return true
        return String(row[filter.field] ?? '') === String(filter.value)
      })

      return matchesKeyword && matchesFilters
    })
  }, [columns, data, extraFilters, isRemote, searchKeyword])

  const total = isRemote ? totalValue : filteredData.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(currentPage, 1), totalPages)
  const filterSnapshot = useMemo(
    () =>
      JSON.stringify({
        keyword: String(searchKeyword ?? ''),
        filters: extraFilters,
      }),
    [extraFilters, searchKeyword]
  )
  const filterSnapshotRef = useRef(filterSnapshot)
  const pagedData = useMemo(() => {
    if (isRemote) {
      return filteredData
    }
    const start = (safePage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, isRemote, pageSize, safePage])

  const pageRowKeys = useMemo(
    () => pagedData.map((row) => String(row[rowKey])),
    [pagedData, rowKey]
  )
  const pageRowKeySet = useMemo(() => new Set(pageRowKeys), [pageRowKeys])
  const allPageSelected =
    pageRowKeys.length > 0 &&
    pageRowKeys.every((key) => selectedRowKeySet.has(key))

  const setPage = useCallback(
    (nextPage: number) => {
      if (!item.meta?.pagePath) return
      store.getState().setValueByPath(item.meta.pagePath, nextPage)
    },
    [item.meta?.pagePath, store]
  )

  const startRow = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endRow = Math.min(safePage * pageSize, total)

  const toggleAllPageRows = useCallback(
    (checked: boolean) => {
      setSelectedRowKeys((prev) => {
        if (checked) {
          return Array.from(new Set([...prev, ...pageRowKeys]))
        }
        return prev.filter((key) => !pageRowKeySet.has(key))
      })
    },
    [pageRowKeys, pageRowKeySet]
  )

  const toggleRow = useCallback((key: string, checked: boolean) => {
    setSelectedRowKeys((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, key]))
      }
      return prev.filter((item) => item !== key)
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedRowKeys([])
  }, [])

  const toggleTreeRow = useCallback((key: string) => {
    setCollapsedRowKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }, [])

  const handleBulkAction = useCallback(
    async (config: any) => {
      if (config?.action?.click) {
        await runActions(store, config.action.click, { selectedRows })
      }
    },
    [selectedRows, store]
  )

  useEffect(() => {
    if (isRemote) return
    if (!item.meta?.pagePath) return
    if (currentPage !== safePage) {
      store.getState().setValueByPath(item.meta.pagePath, safePage)
    }
  }, [currentPage, isRemote, item.meta?.pagePath, safePage, store])

  useEffect(() => {
    if (isRemote) return
    if (!item.meta?.pagePath) return
    if (filterSnapshotRef.current === filterSnapshot) {
      return
    }

    filterSnapshotRef.current = filterSnapshot
    store.getState().setValueByPath(item.meta.pagePath, 1)
  }, [filterSnapshot, isRemote, item.meta?.pagePath, store])

  const visibleRows = useMemo(() => {
    if (!treeMode) {
      return pagedData.map((row) => ({
        row,
        depth: 0,
        hasChildren: false,
        expanded: true,
      }))
    }

    return buildVisibleTreeRows(
      pagedData,
      rowKey,
      treeParentKey,
      collapsedRowKeys
    )
  }, [collapsedRowKeys, pagedData, rowKey, treeMode, treeParentKey])

  if (columns.length === 0) {
    return (
      <div className='p-4 text-sm text-muted-foreground'>
        No columns configured.
      </div>
    )
  }

  return (
    <div className='w-full'>
      <div className='overflow-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className='w-12 bg-background px-4'>
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={(checked) =>
                      toggleAllPageRows(checked === true)
                    }
                    aria-label='全选当前页'
                  />
                </TableHead>
              )}
              {columns.map((col, idx) => {
                const align = resolveColumnAlign(col)
                const fixedColumnProps = resolveFixedColumnProps(
                  fixedColumnLayouts[idx],
                  'head'
                )

                return (
                  <TableHead
                    key={idx}
                    className={cn(
                      'bg-background whitespace-nowrap',
                      resolveColumnHeaderClassName(align),
                      fixedColumnProps.className,
                      col.className
                    )}
                    style={fixedColumnProps.style}
                  >
                    <span
                      className={cn(
                        'inline-flex w-full items-center gap-1.5',
                        resolveColumnContentClassName(align)
                      )}
                    >
                      <span>{col.name || ''}</span>
                      <InlineTip content={col.tip || col.info} />
                    </span>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className='h-24 text-center text-muted-foreground'
                >
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map(
                ({ row, depth, hasChildren, expanded }, rowIdx) => (
                  <TableRow
                    key={String(row[rowKey] ?? rowIdx)}
                    data-state={
                      selectedRowKeySet.has(String(row[rowKey]))
                        ? 'selected'
                        : undefined
                    }
                    className='group/row h-12'
                  >
                    {selectable && (
                      <TableCell className='h-12 px-4'>
                        <Checkbox
                          checked={selectedRowKeySet.has(String(row[rowKey]))}
                          onCheckedChange={(checked) =>
                            toggleRow(String(row[rowKey]), checked === true)
                          }
                          aria-label={`选择 ${getByPath(row, 'username') ?? row[rowKey] ?? rowIdx}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((col, colIdx) => {
                      const align = resolveColumnAlign(col)
                      const fixedColumnProps = resolveFixedColumnProps(
                        fixedColumnLayouts[colIdx],
                        'body'
                      )

                      return (
                        <TableCell
                          key={colIdx}
                          className={cn(
                            'h-12 bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                            fixedColumnProps.className,
                            col.className
                          )}
                          style={fixedColumnProps.style}
                        >
                          <div
                            className={cn(
                              'flex min-w-0 items-center',
                              resolveColumnContentClassName(align)
                            )}
                          >
                            <CellRenderer
                              column={col}
                              value={col.value ? getByPath(row, col.value) : ''}
                              row={row}
                              rowIndex={rowIdx}
                              rowKey={rowKey}
                              tableValuePath={String(item.value || '')}
                              treeMeta={
                                treeMode && col.value === treeLabelField
                                  ? {
                                      depth,
                                      hasChildren,
                                      expanded,
                                      onToggle: () =>
                                        toggleTreeRow(String(row[rowKey])),
                                    }
                                  : undefined
                              }
                              tableMeta={item.meta}
                              onAction={handleAction}
                              store={store}
                              onNavigate={(to, search, options) =>
                                navigate({
                                  to: stripRouterBasePath(to),
                                  search: withBackNavigationSearch(
                                    search,
                                    options?.withBack,
                                    {
                                      from: buildStoreBackNavigationHref(store),
                                    }
                                  ),
                                })
                              }
                            />
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </div>
      {item.meta?.pagePath &&
        !treeMode &&
        !item.meta?.externalPagination &&
        totalPages > 1 &&
        total > pageSize && (
          <div className='flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground'>
            <span>
              {total === 0
                ? 'No results'
                : `${startRow}–${endRow} of ${total} row${total === 1 ? '' : 's'}`}
            </span>
            <div className='flex items-center gap-2'>
              {selectable && selectedRowKeys.length > 0 && (
                <span className='mr-2 text-xs text-foreground'>
                  已选 {selectedRowKeys.length} 项
                </span>
              )}
              <span className='mr-2 text-xs text-muted-foreground'>
                第 {safePage} / {totalPages} 页
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      {selectable && selectedRowKeys.length > 0 && bulkActions.length > 0 && (
        <div className='pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2'>
          <div className='pointer-events-auto flex items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-xl backdrop-blur-lg supports-backdrop-filter:bg-background/60'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-7 rounded-full'
                  onClick={clearSelection}
                >
                  <X className='size-4' />
                  <span className='sr-only'>清空已选项</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>清空已选项</TooltipContent>
            </Tooltip>

            <Separator orientation='vertical' className='h-5' />

            <div className='flex items-center gap-1 text-sm text-foreground'>
              <Badge variant='default' className='min-w-8 rounded-lg px-2'>
                {selectedRowKeys.length}
              </Badge>
              <span>项已选中</span>
            </div>

            <Separator orientation='vertical' className='h-5' />

            {bulkActions.map((actionConfig: any, index: number) => {
              const Icon = resolveLucideIcon(actionConfig?.icon)

              const button = (
                <Button
                  key={actionConfig.id ?? `${item.id}-bulk-action-${index}`}
                  variant={actionConfig?.variant || 'outline'}
                  size={actionConfig?.size || 'icon'}
                  className={cn(actionConfig?.className ?? 'size-9 rounded-xl')}
                  onClick={() => handleBulkAction(actionConfig)}
                >
                  {Icon ? <Icon className='size-4' /> : null}
                  {actionConfig?.label ? (
                    <span>{actionConfig.label}</span>
                  ) : null}
                </Button>
              )

              if (actionConfig?.description) {
                return (
                  <Tooltip
                    key={actionConfig.id ?? `${item.id}-bulk-action-${index}`}
                  >
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent sideOffset={8}>
                      {actionConfig.description}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return button
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function useTableStoreValue(store: NodeItemProps['store'], path?: string) {
  return useStorePathValue(store, path)
}

function useTableFilters(
  store: NodeItemProps['store'],
  config?: Array<{ path: string; field: string }>
) {
  const snapshot = useStore(store, (state) => {
    if (!config?.length) return '[]'

    return JSON.stringify(
      config.map((item) => {
        return {
          field: item.field,
          value: getStoreValueByPath(store, item.path),
        }
      })
    )
  })

  return useMemo(
    () => JSON.parse(snapshot) as Array<{ field: string; value: unknown }>,
    [snapshot]
  )
}

/**
 * 单元格渲染
 */
function CellRenderer({
  column,
  value,
  row,
  rowIndex,
  rowKey,
  tableValuePath,
  treeMeta,
  tableMeta,
  onAction,
  store,
  onNavigate,
}: {
  column: Column
  value: any
  row: any
  rowIndex: number
  rowKey: string
  tableValuePath: string
  treeMeta?: {
    depth: number
    hasChildren: boolean
    expanded: boolean
    onToggle: () => void
  }
  tableMeta?: Record<string, any>
  onAction: (name: string) => Promise<void>
  store: NodeItemProps['store']
  onNavigate: (
    to: string,
    search?: Record<string, string>,
    options?: { withBack?: unknown }
  ) => void
}) {
  const type = column.type || 'show-base'
  const buttonGroup = Array.isArray(column.meta?.buttons)
    ? column.meta.buttons
    : null
  const displayValue = resolveColumnDisplayValue(store, column, value, type)
  const formattedValue = resolveFormattedCellValue(displayValue, row, column)
  const editorType =
    column.editor === true
      ? 'form-input'
      : typeof column.editor === 'string'
        ? column.editor
        : typeof column.meta?.editor?.type === 'string'
          ? column.meta.editor.type
          : column.trigger
            ? 'form-input'
            : ''
  const inlineAction = useMemo(
    () => buildInlineChangeAction(store, tableMeta, column, rowKey),
    [column, rowKey, store, tableMeta]
  )
  const canInlineEdit = useMemo(
    () => canUseInlineEdit(store.getState(), row, rowKey, inlineAction),
    [inlineAction, row, rowKey, store]
  )

  const renderActionButton = (buttonMeta: any, key: string | number) => {
    return (
      <ActionButton
        key={key}
        buttonMeta={buttonMeta}
        store={store}
        record={row}
        context={{ row, rowIndex }}
        defaultVariant={type === 'show-button' ? 'default' : 'ghost'}
        defaultSize='sm'
      />
    )
  }

  const handleValueSaved = useCallback(
    (nextValue: any) => {
      if (!column.value) {
        return
      }

      if (usesArrayInlineAction(inlineAction, store.getState().action)) {
        applyInlineRowPatchByIndex(store, tableValuePath, rowIndex, {
          [column.value]: nextValue,
        })
        return
      }

      applyInlineRowPatch(store, tableValuePath, rowKey, row, {
        [column.value]: nextValue,
      })
    },
    [column.value, inlineAction, row, rowIndex, rowKey, store, tableValuePath]
  )

  switch (type) {
    case 'show-table':
      return (
        <ShowTable
          item={{
            id: String(column.value || column.name || 'nested-table'),
            type,
            value: column.value,
            meta: column.meta,
            className: column.className,
          }}
          value={displayValue}
          setValue={() => {}}
          runAction={onAction}
          store={store}
          layoutId=''
        />
      )

    case 'show-tag':
      return (
        <ShowTag
          item={{
            type,
            value: column.value,
            meta: column.meta,
          }}
          value={displayValue}
          option={resolveColumnOptionList(store, column)}
          setValue={() => {}}
          runAction={onAction}
          store={store}
          layoutId=''
        />
      )

    case 'media-audio':
      return (
        <MediaAudio
          item={{
            type,
            name: column.name,
            value: column.value,
            meta: column.meta,
          }}
          value={displayValue}
          setValue={() => {}}
          runAction={onAction}
          store={store}
          layoutId=''
        />
      )

    case 'media-image':
      return (
        <MediaImage
          item={{
            type,
            name: column.name,
            value: column.value,
            meta: column.meta,
          }}
          value={displayValue}
          setValue={() => {}}
          runAction={onAction}
          store={store}
          layoutId=''
        />
      )

    case 'media-video':
      return (
        <MediaVideo
          item={{
            type,
            name: column.name,
            value: column.value,
            meta: column.meta,
          }}
          value={displayValue}
          setValue={() => {}}
          runAction={onAction}
          store={store}
          layoutId=''
        />
      )

    case 'media-file-list':
      return (
        <MediaFileList
          item={{
            type,
            name: column.name,
            value: column.value,
            meta: column.meta,
          }}
          value={displayValue}
          setValue={() => {}}
          runAction={onAction}
          store={store}
          layoutId=''
        />
      )

    case 'show-icon': {
      const iconName = String(displayValue ?? value ?? '').trim()
      const Icon = resolveLucideIcon(iconName)

      if (!iconName) {
        return <span className='text-sm text-muted-foreground'>-</span>
      }

      if (!Icon) {
        return <span className='text-sm'>{iconName}</span>
      }

      return (
        <span className='inline-flex size-8 items-center justify-center rounded-md border bg-muted/20 text-foreground'>
          <Icon className='size-4' />
        </span>
      )
    }

    case 'show-rich':
      return (
        <ShowRich
          item={{
            type,
            value: column.value,
            meta: column.meta,
          }}
          value={formattedValue}
          setValue={() => {}}
          runAction={onAction}
          store={store}
          layoutId=''
        />
      )

    case 'show-date':
      return (
        <ShowDate
          item={{
            type,
            value: column.value,
            meta: column.meta,
          }}
          value={displayValue}
          setValue={() => {}}
          runAction={onAction}
          store={store}
          layoutId=''
        />
      )

    case 'show-base':
    case 'show-text':
      if (editorType && canInlineEdit) {
        return (
          <EditableShowCell
            column={column}
            value={value}
            displayValue={displayValue}
            row={row}
            rowIndex={rowIndex}
            rowKey={rowKey}
            store={store}
            onAction={onAction}
            onValueSaved={handleValueSaved}
            inlineAction={inlineAction}
            canEdit={canInlineEdit}
          />
        )
      }
      if (treeMeta) {
        return (
          <TreeCellContent
            value={formattedValue}
            depth={treeMeta.depth}
            hasChildren={treeMeta.hasChildren}
            expanded={treeMeta.expanded}
            onToggle={treeMeta.onToggle}
          />
        )
      }
      return <span className='text-sm'>{formatCellText(formattedValue)}</span>

    case 'form-input':
    case 'form-number':
    case 'form-select':
    case 'form-switch':
      if (!canInlineEdit) {
        return <span className='text-sm'>{formatCellText(formattedValue)}</span>
      }

      return (
        <EditableFormCell
          column={column}
          value={value}
          row={row}
          rowIndex={rowIndex}
          rowKey={rowKey}
          store={store}
          onAction={onAction}
          onValueSaved={handleValueSaved}
          inlineAction={inlineAction}
          canEdit={canInlineEdit}
        />
      )

    case 'show-status':
    case 'show-select': {
      const inlineChangeAction = inlineAction
      const editable =
        column.meta?.editable !== false && !!inlineChangeAction && canInlineEdit
      const SelectComponent = type === 'show-status' ? ShowStatus : ShowSelect

      return (
        <SelectComponent
          item={{
            type,
            value: column.value,
            meta: column.meta,
            action: column.action,
          }}
          value={displayValue}
          selectOptions={resolveColumnOptionList(store, column)}
          row={row}
          editable={editable}
          changeAction={inlineChangeAction}
          onValueChangeSuccess={handleValueSaved}
          setValue={() => {}}
          runAction={onAction}
          store={store}
          layoutId=''
        />
      )
    }

    case 'show-link':
    case 'show-button':
      if (buttonGroup?.length) {
        return (
          <div className='flex items-center justify-end gap-2 whitespace-nowrap'>
            {buttonGroup.map((buttonMeta: any, index: number) =>
              renderActionButton(
                buttonMeta,
                buttonMeta.id ?? `${column.name || 'action'}-${index}`
              )
            )}
          </div>
        )
      }

      if (
        Array.isArray(column.meta?.menuItems) &&
        column.meta.menuItems.length > 0
      ) {
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
              >
                <DotsHorizontalIcon className='h-4 w-4' />
                <span className='sr-only'>Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-[160px]'>
              {column.meta.menuItems.map((menuItem: any, index: number) => {
                const actionButton = (
                  <DropdownMenuItem
                    key={menuItem.label || index}
                    variant={
                      menuItem.variant === 'destructive'
                        ? 'destructive'
                        : 'default'
                    }
                    onClick={() => {
                      if (menuItem.modalStateKey && menuItem.formTarget) {
                        store.getState().setData(menuItem.formTarget, {
                          ...row,
                          ...(menuItem.formDefaults || {}),
                        })
                        store
                          .getState()
                          .setPageState(menuItem.modalStateKey, true)
                        return
                      }

                      if (menuItem.to) {
                        const searchParam = menuItem.searchParam || 'id'
                        const searchValue = menuItem.searchField
                          ? row[menuItem.searchField]
                          : row.id
                        onNavigate(
                          menuItem.to,
                          searchValue == null
                            ? undefined
                            : { [searchParam]: String(searchValue) },
                          {
                            withBack:
                              menuItem.withBack ?? menuItem.meta?.withBack,
                          }
                        )
                        return
                      }
                    }}
                  >
                    {menuItem.label}
                    {resolveLucideIcon(menuItem.icon) ? (
                      <DropdownMenuShortcut>
                        {(() => {
                          const ShortcutIcon = resolveLucideIcon(menuItem.icon)
                          return ShortcutIcon ? (
                            <ShortcutIcon size={16} />
                          ) : null
                        })()}
                      </DropdownMenuShortcut>
                    ) : null}
                  </DropdownMenuItem>
                )

                if (menuItem.separatorBefore) {
                  return (
                    <div key={menuItem.label || index}>
                      <DropdownMenuSeparator />
                      {actionButton}
                    </div>
                  )
                }

                return actionButton
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }

      if (column.meta?.to && (column.meta?.open || 'path') === 'modal') {
        return (
          <Button
            variant={
              column.meta?.variant ||
              (type === 'show-button' ? 'default' : 'ghost')
            }
            size={column.meta?.size || 'sm'}
            onClick={() => {
              if (column.meta?.dataTarget) {
                store.getState().setData(column.meta.dataTarget, {
                  ...row,
                  ...(column.meta?.dataDefaults || {}),
                })
              }
              store
                .getState()
                .setPageState(
                  column.meta?.routeKey || 'dialog.route',
                  column.meta.to
                )
              store
                .getState()
                .setPageState(column.meta?.stateKey || 'dialog.open', true)
            }}
          >
            {column.meta?.label || column.name || String(displayValue ?? '')}
          </Button>
        )
      }

      if (column.meta?.to) {
        const searchParam = column.meta?.searchParam || 'id'
        const searchValue = column.meta?.searchField
          ? row[column.meta.searchField]
          : row.id

        return (
          <Button
            variant={
              column.meta?.variant ||
              (type === 'show-button' ? 'default' : 'ghost')
            }
            size={column.meta?.size || 'sm'}
            onClick={() =>
              onNavigate(
                column.meta.to,
                searchValue == null
                  ? undefined
                  : { [searchParam]: String(searchValue) },
                { withBack: column.meta?.withBack }
              )
            }
          >
            {column.meta?.label || column.name || String(displayValue ?? '')}
          </Button>
        )
      }

      return renderActionButton(
        {
          ...column.meta,
          label:
            column.meta?.label || column.name || String(displayValue ?? ''),
          action: column.action,
        },
        column.name || String(displayValue ?? '')
      )
    default:
      return <span className='text-sm'>{formatCellText(formattedValue)}</span>
  }
}

function usesArrayInlineAction(
  action: any,
  actionMap: Record<string, any>,
  visited = new Set<string>()
): boolean {
  if (Array.isArray(action)) {
    return action.some((current) =>
      usesArrayInlineAction(current, actionMap, visited)
    )
  }

  if (typeof action === 'string') {
    if (visited.has(action)) {
      return false
    }
    visited.add(action)
    return usesArrayInlineAction(actionMap[action], actionMap, visited)
  }

  if (!action || typeof action !== 'object') {
    return false
  }

  return (
    String(action.type || '')
      .trim()
      .toLowerCase() === 'array'
  )
}

function TreeCellContent({
  value,
  depth,
  hasChildren,
  expanded,
  onToggle,
}: {
  value: any
  depth: number
  hasChildren: boolean
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div
      className='flex items-center gap-2'
      style={{ paddingLeft: `${depth * 22}px` }}
    >
      {hasChildren ? (
        <button
          type='button'
          onClick={onToggle}
          className='inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground'
        >
          <ChevronRight
            className={cn(
              'size-4 transition-transform',
              expanded && 'rotate-90'
            )}
          />
        </button>
      ) : (
        <span className='inline-flex size-6' />
      )}
      <span className='truncate text-sm'>{formatCellText(value)}</span>
    </div>
  )
}

function buildVisibleTreeRows(
  rows: any[],
  rowKey: string,
  parentKey: string,
  collapsedRowKeys: string[]
) {
  const byParent = new Map<string, any[]>()
  const roots: any[] = []
  const rowMap = new Map<string, any>()
  const collapsedSet = new Set(collapsedRowKeys)

  rows.forEach((row) => {
    const key = String(row?.[rowKey] ?? '')
    if (!key) return
    rowMap.set(key, row)
  })

  rows.forEach((row) => {
    const key = String(row?.[rowKey] ?? '')
    if (!key) return
    const parentValue = row?.[parentKey]
    const parentKeyValue =
      parentValue == null ||
      String(parentValue) === '' ||
      String(parentValue) === '0'
        ? ''
        : String(parentValue)

    if (!parentKeyValue || !rowMap.has(parentKeyValue)) {
      roots.push(row)
      return
    }

    const siblings = byParent.get(parentKeyValue) || []
    siblings.push(row)
    byParent.set(parentKeyValue, siblings)
  })

  const result: Array<{
    row: any
    depth: number
    hasChildren: boolean
    expanded: boolean
  }> = []

  const walk = (items: any[], depth: number) => {
    items.forEach((row) => {
      const key = String(row?.[rowKey] ?? '')
      const children = byParent.get(key) || []
      const hasChildren = children.length > 0
      const expanded = !collapsedSet.has(key)

      result.push({
        row,
        depth,
        hasChildren,
        expanded,
      })

      if (hasChildren && expanded) {
        walk(children, depth + 1)
      }
    })
  }

  walk(roots, 0)
  return result
}

function resolveColumnDisplayValue(
  store: NodeItemProps['store'],
  column: Column,
  value: any,
  type: string
) {
  if (value == null || !column.value) {
    return value
  }

  const optionList = resolveColumnOptionList(store, column)
  if (!Array.isArray(optionList)) {
    return value
  }

  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'object') {
    return value
  }

  const matched = optionList.find(
    (item: any) => String(item?.id ?? '') === String(value)
  )
  if (!matched) {
    return value
  }

  if (type === 'show-status' || type === 'show-select') {
    return matched
  }

  return matched.label ?? matched.value ?? value
}

function resolveFormattedCellValue(
  displayValue: unknown,
  row: any,
  column: Column
) {
  const meta = column.meta
  if (!meta) {
    return displayValue
  }

  const template = String(meta.template || '').trim()
  if (template) {
    return resolveTableTemplateText(template, displayValue, row)
  }

  const cases = Array.isArray(meta.cases) ? meta.cases : []
  for (const current of cases) {
    const fieldPath = String(current?.field || '').trim()
    if (!fieldPath) {
      continue
    }

    const rowValue = getByPath(row, fieldPath)
    if (String(rowValue ?? '') !== String(current?.value ?? '')) {
      continue
    }

    const text = String(current?.text || '').trim()
    if (text) {
      return text
    }
  }

  const format = String(meta.format || '')
    .trim()
    .toLowerCase()
  if (format && format !== 'count') {
    return formatDisplayValue(displayValue, format)
  }

  if (format !== 'count') {
    return displayValue
  }

  const count = resolveDisplayCount(displayValue)
  const countTemplate = String(meta.countText || '').trim()
  if (countTemplate) {
    return countTemplate.replaceAll('{count}', String(count))
  }

  const unit = String(meta.countUnit || '').trim()
  if (unit) {
    return `${count}${unit}`
  }

  return String(count)
}

function resolveTableTemplateText(template: string, value: unknown, row: any) {
  return template
    .replace(/\{([^{}]+)\}/g, (_, rawKey: string) => {
      const key = String(rawKey || '').trim()
      if (!key) {
        return ''
      }
      if (key === 'value') {
        return stringifyTableTemplateValue(value)
      }
      if (key.startsWith('row.')) {
        return stringifyTableTemplateValue(getByPath(row, key.slice(4)))
      }
      return stringifyTableTemplateValue(getByPath(row, key))
    })
    .replace(/\s+\/\s+$/g, '')
    .replace(/^\s+\/\s+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function stringifyTableTemplateValue(value: unknown) {
  if (value == null) {
    return ''
  }
  if (typeof value === 'object') {
    for (const key of ['label', 'value', 'name', 'id']) {
      const current = (value as Record<string, unknown>)[key]
      if (current != null && current !== '') {
        return String(current)
      }
    }
    return ''
  }
  return String(value)
}

function resolveDisplayCount(value: unknown) {
  if (Array.isArray(value)) {
    return value.length
  }

  if (value == null || value === '') {
    return 0
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'object' && 'length' in Object(value)) {
    const lengthValue = Number((value as { length?: unknown }).length)
    return Number.isFinite(lengthValue) ? lengthValue : 0
  }

  return 1
}

function formatCellText(value: unknown) {
  if (value == null) {
    return ''
  }

  if (Array.isArray(value)) {
    return value
      .map((current) => formatCellText(current))
      .filter(Boolean)
      .join(' / ')
  }

  if (typeof value === 'object') {
    for (const key of ['label', 'value', 'name', 'id']) {
      const current = (value as Record<string, unknown>)[key]
      if (current != null && current !== '') {
        return String(current)
      }
    }
    return ''
  }

  return String(value)
}
