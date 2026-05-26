import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DragEvent, HTMLAttributes, KeyboardEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { GripVertical } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { runActionsWithResult } from '@/lib/action'
import { cn } from '@/lib/utils'
import { getByPath, resolvePath, setByPath } from '@/lib/path'
import { getCurrentRouterPathname } from '@/lib/router-path'
import { ActionButton } from './shared/action-button'
import { ShowStatus } from './status'
import type { NodeItemProps } from '../../nodes'

const ALL_CATEGORY_VALUE = '__all__'
const UNCATEGORIZED_CATEGORY_VALUE = '__uncategorized__'

export function ShowCategoryList({
  item,
  value,
  setValue,
  option,
  optionLoading,
  store,
}: NodeItemProps) {
  const navigate = useNavigate()
  const optionCategories = useMemo(() => (Array.isArray(option) ? option : []), [option])
  const countField = String(item.meta?.countField || '').trim()
  const summaryCounts = useMemo(
    () => resolveCategorySummaryCounts(optionCategories, countField),
    [optionCategories, countField]
  )
  const resolvedCategories = useMemo(
    () => optionCategories.filter((category) => !isCategorySummaryValue(category?.id)),
    [optionCategories]
  )
  const [categories, setCategories] = useState(resolvedCategories)
  const currentValue = normalizeCategoryValue(value)
  const queryKey = resolveCategoryQueryKey(item.value, item.meta?.queryKey)
  const labelField = String(item.meta?.labelField || 'value').trim() || 'value'
  const emptyText = String(item.meta?.emptyText || '暂无分类。').trim() || '暂无分类。'
  const title = String(item.meta?.title || item.name || '').trim()
  const description = String(item.meta?.description || item.info || '').trim()
  const createButton = isPlainObject(item.meta?.createButton) ? item.meta?.createButton : null
  const itemButtons = Array.isArray(item.meta?.buttons) ? item.meta.buttons : []
  const allowClear = item.meta?.allowClear === true
  const clearLabel = String(item.meta?.clearLabel || '全部').trim() || '全部'
  const allowUncategorized = item.meta?.uncategorized === true
  const uncategorizedLabel = String(item.meta?.uncategorizedLabel || '未分类').trim() || '未分类'
  const selectable = item.meta?.selectable !== false
  const remote = item.meta?.remote === true
  const defaultFirst = item.meta?.defaultFirst === true
  const sortable = item.meta?.sortable === true
  const sortField = String(item.meta?.sortField || 'sort').trim() || 'sort'
  const sortChangeAction = item.meta?.sortChangeAction
  const statusField = String(item.meta?.statusField || '').trim()
  const statusOptions = useMemo(() => buildCategoryStatusOptions(item.meta), [item.meta])
  const statusChangeAction = item.meta?.statusChangeAction
  const statusDisplay = String(item.meta?.statusDisplay || 'select').trim() || 'select'
  const statusMeta = isPlainObject(item.meta?.statusMeta) ? item.meta.statusMeta : {}
  const showClearRow = selectable && allowClear
  const showUncategorizedRow = selectable && allowUncategorized
  const hasVisibleRows = categories.length > 0 || showClearRow || showUncategorizedRow
  const [dragCategoryID, setDragCategoryID] = useState('')
  const categorySignature = useMemo(
    () =>
      JSON.stringify(
        categories.map((category) => ({
          id: category.id,
          value: category.value,
        }))
      ),
    [categories]
  )
  const hasCurrentCategory = useMemo(
    () =>
      currentValue !== '' &&
      categories.some((category) => normalizeCategoryValue(category.id) === currentValue),
    [categories, currentValue]
  )
  const firstCategoryID = categories[0]?.id

  const applyCategorySelection = useCallback(
    (nextValue: unknown, options?: { replace?: boolean }) => {
      if (!selectable) {
        return
      }

      const normalizedValue = normalizeCategoryValue(nextValue)
      const assignValue = normalizedValue || ''
      setValue(assignValue)

      if (!remote || !queryKey) {
        return
      }

      navigate({
        to: getCurrentRouterPathname(),
        replace: options?.replace === true,
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          [queryKey]: assignValue || undefined,
          page: undefined,
        }),
      })
    },
    [navigate, queryKey, remote, selectable, setValue]
  )

  useEffect(() => {
    setCategories(resolvedCategories)
  }, [resolvedCategories])

  useEffect(() => {
    if (!selectable || !defaultFirst || categories.length === 0) {
      return
    }

    if (hasCurrentCategory) {
      return
    }

    void applyCategorySelection(firstCategoryID, { replace: true })
  }, [
    applyCategorySelection,
    categorySignature,
    defaultFirst,
    firstCategoryID,
    hasCurrentCategory,
    selectable,
  ])

  const handleStatusSaved = useCallback(
    (category: Record<string, any>, nextValue: string | number) => {
      if (!statusField) {
        return
      }

      setCategories((currentCategories) =>
        currentCategories.map((currentCategory) => {
          if (String(currentCategory?.id ?? '') !== String(category?.id ?? '')) {
            return currentCategory
          }

          return setByPath(currentCategory, statusField, nextValue)
        })
      )
    },
    [statusField]
  )

  const handleCategoryDrop = useCallback(
    async (targetCategoryID: string) => {
      if (
        !sortable ||
        !sortChangeAction ||
        !dragCategoryID ||
        dragCategoryID === targetCategoryID
      ) {
        setDragCategoryID('')
        return
      }

      const reorderedCategories = reorderCategories(categories, dragCategoryID, targetCategoryID)
      if (reorderedCategories === categories) {
        setDragCategoryID('')
        return
      }

      const sortedCategories = assignCategorySortValues(
        reorderedCategories,
        categories,
        sortField
      )
      const sortUpdates = resolveCategorySortUpdates(categories, sortedCategories, sortField)
      setCategories(sortedCategories)
      setDragCategoryID('')

      for (const update of sortUpdates) {
        const result = await runActionsWithResult(store, sortChangeAction, {
          row: update.row,
          value: update.value,
          sort: update.value,
        })

        if (!result.success) {
          setCategories(categories)
          return
        }
      }
    },
    [categories, dragCategoryID, sortChangeAction, sortField, sortable, store]
  )

  return (
    <section className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-1">
          {title ? <h2 className="text-sm font-semibold text-foreground">{title}</h2> : null}
          {description ? (
            <p className="text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {createButton ? (
          <ActionButton
            buttonMeta={createButton}
            store={store}
            defaultVariant="outline"
            defaultSize="sm"
          />
        ) : null}
      </div>

      <ScrollArea className="max-h-[32rem]">
        <div className="space-y-1 p-2">
          {optionLoading && !hasVisibleRows ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">加载中...</div>
          ) : null}

          {!optionLoading && !hasVisibleRows ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
          ) : null}

          {showClearRow ? (
            <div
              role="button"
              tabIndex={0}
              aria-pressed={currentValue === ''}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                currentValue === ''
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
              onClick={() => {
                void applyCategorySelection('')
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }
                event.preventDefault()
                void applyCategorySelection('')
              }}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{clearLabel}</span>
              {summaryCounts.all != null ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {summaryCounts.all}
                </span>
              ) : null}
            </div>
          ) : null}

          {showUncategorizedRow ? (
            <div
              role="button"
              tabIndex={0}
              aria-pressed={currentValue === UNCATEGORIZED_CATEGORY_VALUE}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                currentValue === UNCATEGORIZED_CATEGORY_VALUE
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
              onClick={() => {
                void applyCategorySelection(UNCATEGORIZED_CATEGORY_VALUE)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }
                event.preventDefault()
                void applyCategorySelection(UNCATEGORIZED_CATEGORY_VALUE)
              }}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{uncategorizedLabel}</span>
              {summaryCounts.uncategorized != null ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {summaryCounts.uncategorized}
                </span>
              ) : null}
            </div>
          ) : null}

          {categories.map((category) => {
            const categoryID = normalizeCategoryValue(category.id)
            const active = currentValue !== '' && categoryID === currentValue
            const categoryLabel = resolveCategoryLabel(category, labelField)
            const categoryStatus = resolveCategoryStatusValue(
              category,
              statusField,
              statusOptions
            )
            const categoryCount = resolveCategoryCountValue(category, countField)
            const handleActivate = () => {
              void applyCategorySelection(category.id)
            }
            const interactionProps: HTMLAttributes<HTMLDivElement> = selectable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-pressed': active,
                  onClick: handleActivate,
                  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key !== 'Enter' && event.key !== ' ') {
                      return
                    }
                    event.preventDefault()
                    handleActivate()
                  },
                }
              : {}
            const dragProps: HTMLAttributes<HTMLDivElement> = sortable
              ? {
                  draggable: true,
                  onDragStart: (event: DragEvent<HTMLDivElement>) => {
                    event.dataTransfer.effectAllowed = 'move'
                    setDragCategoryID(categoryID)
                  },
                  onDragOver: (event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  },
                  onDrop: (event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault()
                    void handleCategoryDrop(categoryID)
                  },
                  onDragEnd: () => setDragCategoryID(''),
                }
              : {}

            return (
              <div
                key={categoryID || categoryLabel}
                {...interactionProps}
                {...dragProps}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  selectable
                    ? active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    : 'text-foreground',
                  sortable ? 'cursor-grab active:cursor-grabbing' : null,
                  dragCategoryID === categoryID ? 'opacity-50' : null
                )}
              >
                {sortable ? (
                  <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                ) : null}
                <span className="min-w-0 flex-1 truncate font-medium">{categoryLabel}</span>
                {categoryCount != null ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {categoryCount}
                  </span>
                ) : null}
                {categoryStatus ? (
                  <span
                    className="shrink-0"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <ShowStatus
                      item={{
                        type: 'show-status',
                        value: statusField,
                        meta: {
                          display: statusDisplay,
                          ...statusMeta,
                        },
                      } as any}
                      value={categoryStatus}
                      setValue={() => {}}
                      runAction={async () => {}}
                      store={store}
                      layoutId=""
                      row={category}
                      editable={!!statusChangeAction}
                      changeAction={statusChangeAction}
                      onValueChangeSuccess={(nextValue) => handleStatusSaved(category, nextValue)}
                      selectOptions={statusOptions}
                    />
                  </span>
                ) : null}
                {itemButtons.length > 0 ? (
                  <span
                    className="flex shrink-0 items-center gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {itemButtons.map((buttonMeta: any, index: number) => (
                      <ActionButton
                        key={buttonMeta?.id ?? `${categoryID || 'category'}-button-${index}`}
                        buttonMeta={buttonMeta}
                        store={store}
                        record={category}
                        context={{ row: category }}
                        defaultVariant="ghost"
                        defaultSize="sm"
                      />
                    ))}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </section>
  )
}

function resolveCategoryQueryKey(valuePath?: string, overrideKey?: unknown) {
  const customKey = String(overrideKey || '').trim()
  if (customKey) {
    return customKey
  }

  const path = String(valuePath || '').trim()
  if (!path) {
    return ''
  }

  const { key } = resolvePath(path)
  const segments = key.split('.').filter(Boolean)
  return segments[segments.length - 1] || ''
}

function resolveCategoryLabel(category: Record<string, any>, labelField: string) {
  const displayValue = getByPath(category, labelField)
  if (displayValue != null && String(displayValue).trim() !== '') {
    return String(displayValue)
  }

  if (category.value != null && String(category.value).trim() !== '') {
    return String(category.value)
  }

  return String(category.id ?? '')
}

function normalizeCategoryValue(value: unknown) {
  return String(value ?? '').trim()
}

function reorderCategories(
  categories: Array<Record<string, any>>,
  sourceID: string,
  targetID: string
) {
  const sourceIndex = categories.findIndex(
    (category) => normalizeCategoryValue(category.id) === sourceID
  )
  const targetIndex = categories.findIndex(
    (category) => normalizeCategoryValue(category.id) === targetID
  )

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return categories
  }

  const nextCategories = [...categories]
  const [sourceCategory] = nextCategories.splice(sourceIndex, 1)
  nextCategories.splice(targetIndex, 0, sourceCategory)
  return nextCategories
}

function assignCategorySortValues(
  nextCategories: Array<Record<string, any>>,
  previousCategories: Array<Record<string, any>>,
  sortField: string
) {
  const sortValues = previousCategories.map((category, index) =>
    normalizeCategorySortValue(getByPath(category, sortField), index)
  )

  return nextCategories.map((category, index) =>
    setByPath(category, sortField, sortValues[index] ?? (index + 1) * 10)
  )
}

function resolveCategorySortUpdates(
  previousCategories: Array<Record<string, any>>,
  nextCategories: Array<Record<string, any>>,
  sortField: string
) {
  const previousSortByID = new Map<string, unknown>()
  for (const category of previousCategories) {
    previousSortByID.set(normalizeCategoryValue(category.id), getByPath(category, sortField))
  }

  return nextCategories
    .map((category) => ({
      row: category,
      value: getByPath(category, sortField),
      previousValue: previousSortByID.get(normalizeCategoryValue(category.id)),
    }))
    .filter((update) => String(update.value ?? '') !== String(update.previousValue ?? ''))
}

function normalizeCategorySortValue(value: unknown, index: number) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : (index + 1) * 10
}

function resolveCategoryStatusValue(
  category: Record<string, any>,
  statusField: string,
  statusOptions: Array<Record<string, any>>
) {
  if (!statusField) {
    return null
  }

  const rawValue = getByPath(category, statusField)
  const matched = statusOptions.find(
    (current) => String(current?.id ?? '') === String(rawValue ?? '')
  )

  if (matched) {
    return matched
  }

  if (rawValue == null || String(rawValue).trim() === '') {
    return null
  }

  return {
    id: rawValue,
    value: String(rawValue),
    label: String(rawValue),
    color: resolveCategoryStatusToneColor(undefined),
  }
}

function resolveCategoryCountValue(category: Record<string, any>, countField: string) {
  if (!countField) {
    return null
  }

  const rawValue = getByPath(category, countField)
  if (rawValue == null || String(rawValue).trim() === '') {
    return null
  }

  const count = Number(rawValue)
  if (!Number.isFinite(count)) {
    return null
  }

  return count
}

function resolveCategorySummaryCounts(categories: Record<string, any>[], countField: string) {
  return {
    all: resolveCategoryCountValue(
      categories.find((category) => normalizeCategoryValue(category?.id) === ALL_CATEGORY_VALUE) ||
        null,
      countField
    ),
    uncategorized: resolveCategoryCountValue(
      categories.find(
        (category) => normalizeCategoryValue(category?.id) === UNCATEGORIZED_CATEGORY_VALUE
      ) || null,
      countField
    ),
  }
}

function isCategorySummaryValue(value: unknown) {
  const normalizedValue = normalizeCategoryValue(value)
  return normalizedValue === ALL_CATEGORY_VALUE || normalizedValue === UNCATEGORIZED_CATEGORY_VALUE
}

function buildCategoryStatusOptions(meta: Record<string, any> | undefined) {
  const statusCases = Array.isArray(meta?.statusCases) ? meta.statusCases : []

  return statusCases
    .filter((current) => current && current.value !== undefined && current.value !== null)
    .map((current) => ({
      id: current.value,
      value: String(current.text ?? current.label ?? current.value ?? '').trim(),
      label: String(current.text ?? current.label ?? current.value ?? '').trim(),
      color: current.color || resolveCategoryStatusToneColor(current.tone),
      className: current.className,
    }))
}

function resolveCategoryStatusToneColor(tone: unknown) {
  switch (String(tone || '').trim().toLowerCase()) {
    case 'success':
      return '#0f766e'
    case 'danger':
      return '#dc2626'
    case 'warning':
      return '#d97706'
    case 'info':
      return '#0369a1'
    case 'muted':
    default:
      return '#737373'
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
