import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import {
  applyOptionFilters,
  buildOptionRegistrySignature,
  collectOptionFilterDependencies,
} from '@/lib/option-filter'
import { getByPath, resolvePath } from '@/lib/path'
import { inferRelationPath } from '@/lib/relation-field'
import {
  deleteRemoteOptionPromise,
  getCachedRemoteOptionResult,
  getRemoteOptionPromise,
  setCachedRemoteOptionResult,
  setRemoteOptionPromise,
} from '@/lib/remote-option-cache'
import { request } from '@/lib/request'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableOptionPicker } from '@/components/searchable-option-picker'
import type { NodeItemProps } from '../../nodes'

type CascaderOption = {
  id: string | number
  value: string
  leaf?: boolean
} & Record<string, any>

export function FormCascader({
  item,
  value,
  setValue,
  store,
  error,
  row,
}: NodeItemProps) {
  const api = String(item.meta?.api || '').trim()
  const leafValueMode = resolveLeafValueMode(item.meta)
  const [leafPathValues, setLeafPathValues] = useState<any[]>([])
  const selectedValues = useMemo(
    () => (leafValueMode ? leafPathValues : normalizeCascaderValues(value)),
    [leafPathValues, leafValueMode, value]
  )
  const selectedKeys = useMemo(
    () => selectedValues.map((current) => String(current)).join('|'),
    [selectedValues]
  )
  const placeholders = useMemo(
    () =>
      Array.isArray(item.meta?.placeholder)
        ? item.meta.placeholder.map(String)
        : [],
    [item.meta?.placeholder]
  )
  const levelSearchPlaceholders = useMemo(() => {
    if (Array.isArray(item.meta?.searchPlaceholder)) {
      return item.meta.searchPlaceholder.map(String)
    }
    return []
  }, [item.meta?.searchPlaceholder])
  const sharedSearchPlaceholder = String(
    Array.isArray(item.meta?.searchPlaceholder)
      ? ''
      : item.meta?.searchPlaceholder || ''
  ).trim()
  const labelTarget = String(item.meta?.labelTarget || '').trim()
  const searchable = item.meta?.searchable !== false
  const childParentField = useMemo(
    () =>
      String(item.meta?.childParentField || item.meta?.parentField || '').trim(),
    [item.meta?.childParentField, item.meta?.parentField]
  )
  const rowRelation = useMemo(
    () => resolveRowRelation(row, item.value),
    [item.value, row]
  )
  const rowRelationParentId = childParentField
    ? rowRelation?.[childParentField]
    : undefined
  const rowRelationLeafId = rowRelation?.id
  const fallbackLabels = useMemo(
    () => resolveFallbackLabels(store, item, labelTarget),
    [item, labelTarget, store]
  )
  const [levels, setLevels] = useState<CascaderOption[][]>([])
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null)
  const keepParentOnEmptyRef = useRef(false)
  const optionFilterDependencies = useMemo(
    () => collectOptionFilterDependencies(item),
    [item]
  )
  const optionFilterKey = useStore(
    store,
    useCallback(
      (state) =>
        JSON.stringify({
          values: optionFilterDependencies.pathValues.map((path) =>
            resolveFilterPathValue(path, state.data, state.state)
          ),
          sourceOptions: optionFilterDependencies.sourceNodeIds.map((id) =>
            buildOptionRegistrySignature(state.optionRegistry[id])
          ),
        }),
      [
        optionFilterDependencies.pathValues,
        optionFilterDependencies.sourceNodeIds,
      ]
    )
  )
  const displayLevels = useMemo(
    () =>
      levels.map((options, level) => {
        if (level === 0) {
          return options
        }
        const filteredOptions = applyOptionFilters(options, item, {
          data: store.getState().data,
          state: store.getState().state,
          optionRegistry: store.getState().optionRegistry,
        }) as CascaderOption[] | undefined
        return filteredOptions || []
      }),
    [item, levels, optionFilterKey, store]
  )

  const buildParams = useCallback(
    (parentId: any, level: number) => {
      const childLevel =
        level > 0 && String(item.meta?.childUse || '').trim() !== ''
      const use = childLevel
        ? String(item.meta?.childUse || '').trim()
        : String(item.meta?.use || '').trim()
      const parentField = childLevel
        ? String(
            item.meta?.childParentField || item.meta?.parentField || 'parent_id'
          ).trim()
        : String(item.meta?.parentField || 'parent_id').trim()
      const params: Record<string, any> = {
        type: String(item.meta?.type || 'model').trim() || 'model',
        use,
        parentField: parentField || 'parent_id',
        parentId,
        rootValue: item.meta?.rootValue ?? 0,
        valueField: String(item.meta?.valueField || 'id').trim() || 'id',
        labelField: String(item.meta?.labelField || 'name').trim() || 'name',
      }
      const extraFields = childLevel
        ? String(item.meta?.childExtraFields || '').trim()
        : String(item.meta?.extraFields || '').trim()
      const leafField = String(item.meta?.leafField || 'leaf').trim()
      const order = String(item.meta?.order || '').trim()
      if (extraFields) {
        params.extraFields = extraFields
      }
      if (leafField) {
        params.leafField = leafField
      }
      if (order) {
        params.order = order
      }
      return params
    },
    [
      item.meta?.childExtraFields,
      item.meta?.childParentField,
      item.meta?.childUse,
      item.meta?.extraFields,
      item.meta?.labelField,
      item.meta?.leafField,
      item.meta?.order,
      item.meta?.parentField,
      item.meta?.rootValue,
      item.meta?.type,
      item.meta?.use,
      item.meta?.valueField,
    ]
  )

  const fetchLevelOptions = useCallback(
    async (parentId: any, level: number) => {
      const childLevel =
        level > 0 && String(item.meta?.childUse || '').trim() !== ''
      const params = buildParams(parentId, level)
      const cacheKey = buildRemoteOptionCacheKey(api, params)
      const cached = getCachedRemoteOptionResult<CascaderOption[]>(cacheKey)
      if (cached) {
        return cached
      }

      setLoadingLevel(level)
      const pending = getRemoteOptionPromise<CascaderOption[]>(cacheKey)
      if (pending) {
        try {
          return (await pending) || []
        } finally {
          setLoadingLevel((current) => (current === level ? null : current))
        }
      }

      const nextRequest = request(api, 'get', params)
        .then((result) => {
          if (result.code !== 0 || !Array.isArray(result.data)) {
            return []
          }

          const nextOptions = normalizeRemoteOptions(result.data, childLevel)
          setCachedRemoteOptionResult(cacheKey, nextOptions)
          return nextOptions
        })
        .finally(() => {
          deleteRemoteOptionPromise(cacheKey)
        })

      setRemoteOptionPromise(cacheKey, nextRequest)
      try {
        return await nextRequest
      } finally {
        setLoadingLevel((current) => (current === level ? null : current))
      }
    },
    [api, buildParams, item.meta?.childUse]
  )

  useEffect(() => {
    if (!leafValueMode) {
      return
    }

    let cancelled = false
    async function resolveLeafPath() {
      const leafValue = String(value ?? '').trim()
      const childUse = String(item.meta?.childUse || '').trim()
      if (isEmptyCascaderValue(leafValue)) {
        if (keepParentOnEmptyRef.current) {
          keepParentOnEmptyRef.current = false
          return
        }
        setLeafPathValues(resolveDefaultParentValues(item.meta))
        return
      }
      if (!api || !childUse || !childParentField) {
        setLeafPathValues([])
        return
      }
      const rowParentId = rowRelationParentId
      const rowLeafId = rowRelationLeafId ?? leafValue
      if (rowParentId && String(rowLeafId) === leafValue) {
        setLeafPathValues([rowParentId, rowLeafId])
        return
      }

      const leafPath = await fetchSelectedLeafPath(
        api,
        {
          type: String(item.meta?.type || 'model').trim() || 'model',
          use: childUse,
          selected: leafValue,
          valueField: String(item.meta?.valueField || 'id').trim() || 'id',
          labelField: String(item.meta?.labelField || 'name').trim() || 'name',
          extraFields: childParentField,
          pageSize: 1,
        },
        childParentField,
        leafValue
      )
      if (cancelled || !leafPath) {
        return
      }

      setLeafPathValues(leafPath)
    }

    void resolveLeafPath()
    return () => {
      cancelled = true
    }
  }, [
    api,
    childParentField,
    item.meta?.childUse,
    item.meta?.defaultParentId,
    item.meta?.defaultParentValue,
    item.meta?.labelField,
    item.meta?.type,
    item.meta?.valueField,
    leafValueMode,
    rowRelationLeafId,
    rowRelationParentId,
    value,
  ])

  const syncSelectedLabels = useCallback(
    (items: string[]) => {
      if (!labelTarget) {
        return
      }
      const current = store.getState().getValueByPath(labelTarget)
      const currentItems = Array.isArray(current)
        ? current.map((item) => String(item))
        : []
      if (isSameLabelValues(currentItems, items)) {
        return
      }
      store.getState().setValueByPath(labelTarget, items)
    },
    [labelTarget, store]
  )

  useEffect(() => {
    let cancelled = false

    async function syncLevels() {
      if (!api || !String(item.meta?.use || '').trim()) {
        setLevels([])
        syncSelectedLabels(fallbackLabels)
        return
      }

      const rootParent = item.meta?.rootValue ?? 0
      const nextLevels: CascaderOption[][] = []
      const validValues: Array<string | number> = []
      const labels: string[] = []

      const rootOptions = await fetchLevelOptions(rootParent, 0)
      if (cancelled) {
        return
      }
      nextLevels[0] = rootOptions

      for (let level = 0; level < selectedValues.length; level += 1) {
        const currentOptions = nextLevels[level] || []
        if (!currentOptions.length) {
          break
        }

        const selected = currentOptions.find(
          (current) => String(current.id) === String(selectedValues[level])
        )
        if (!selected) {
          break
        }

        validValues.push(selected.id)
        labels.push(selected.value)

        if (selected.leaf === true) {
          break
        }

        const childOptions = await fetchLevelOptions(selected.id, level + 1)
        if (cancelled) {
          return
        }
        if (!childOptions.length) {
          break
        }
        nextLevels[level + 1] = childOptions
      }

      const nextLabels = labels.length > 0 ? labels : fallbackLabels
      setLevels(nextLevels)
      syncSelectedLabels(nextLabels)
      if (
        nextLevels[0]?.length &&
        !isSameCascaderValues(selectedValues, validValues)
      ) {
        if (leafValueMode) {
          setLeafPathValues(validValues)
        } else {
          setValue(validValues)
        }
      }
    }

    syncLevels()
    return () => {
      cancelled = true
    }
  }, [
    api,
    fetchLevelOptions,
    item.meta?.rootValue,
    item.meta?.use,
    fallbackLabels,
    leafValueMode,
    selectedKeys,
    setValue,
    syncSelectedLabels,
  ])

  const allowWrap = item.meta?.wrap !== false

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2',
        allowWrap ? 'flex-wrap' : 'flex-nowrap overflow-x-auto'
      )}
    >
      {displayLevels.length === 0 ? (
        <div
          className={cn(
            'flex h-10 w-[14rem] max-w-full min-w-[10rem] items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-xs',
            item.meta?.controlClassName
          )}
        >
          {loadingLevel === 0
            ? '正在加载...'
            : fallbackLabels.length > 0
              ? fallbackLabels.join(' / ')
              : item.placeholder || '请选择'}
        </div>
      ) : null}
      {displayLevels.map((options, level) => {
        if (!options.length) {
          return null
        }

        const currentValue = selectedValues[level]
        const placeholder =
          placeholders[level] ||
          (level === 0
            ? item.placeholder || '请选择'
            : `请选择第 ${level + 1} 级`)
        const searchPlaceholder =
          levelSearchPlaceholders[level] ||
          sharedSearchPlaceholder ||
          (placeholders[level]
            ? `输入${placeholders[level]}筛选...`
            : '输入关键词筛选...')

        if (searchable) {
          return (
            <SearchableOptionPicker
              key={`level-${level}`}
              value={currentValue != null ? String(currentValue) : undefined}
              options={options}
              placeholder={loadingLevel === level ? '正在加载...' : placeholder}
              searchPlaceholder={searchPlaceholder}
              emptyText='未找到匹配选项'
              disabled={!!item.meta?.disabled}
              error={!!error}
              className={cn(
                'w-[14rem] max-w-full min-w-[10rem]',
                item.meta?.controlClassName
              )}
              onChange={(nextValue) => {
                const nextSelectedValue = Array.isArray(nextValue)
                  ? nextValue[0]
                  : nextValue
                const selected = options.find(
                  (current) => String(current.id) === String(nextSelectedValue)
                )
                if (!selected) {
                  return
                }
                const nextValues = [
                  ...selectedValues.slice(0, level),
                  selected.id,
                ]
                if (leafValueMode) {
                  setLeafPathValues(nextValues)
                  keepParentOnEmptyRef.current =
                    level === 0 && selected.leaf !== true
                  setValue(
                    level === 0 && selected.leaf !== true ? '' : selected.id
                  )
                  return
                }
                setValue(nextValues)
              }}
            />
          )
        }

        return (
          <Select
            key={`level-${level}`}
            value={currentValue != null ? String(currentValue) : ''}
            disabled={!!item.meta?.disabled}
            onValueChange={(nextValue) => {
              const selected = options.find(
                (current) => String(current.id) === nextValue
              )
              if (!selected) {
                return
              }
              const nextValues = [
                ...selectedValues.slice(0, level),
                selected.id,
              ]
              if (leafValueMode) {
                setLeafPathValues(nextValues)
                keepParentOnEmptyRef.current =
                  level === 0 && selected.leaf !== true
                setValue(
                  level === 0 && selected.leaf !== true ? '' : selected.id
                )
                return
              }
              setValue(nextValues)
            }}
          >
            <SelectTrigger
              aria-invalid={!!error}
              className={cn(
                'w-[14rem] max-w-full min-w-[10rem]',
                error &&
                  'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
                item.meta?.controlClassName
              )}
            >
              <SelectValue
                placeholder={
                  loadingLevel === level ? '正在加载...' : placeholder
                }
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((current) => (
                <SelectItem key={String(current.id)} value={String(current.id)}>
                  {current.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}
    </div>
  )
}

function normalizeCascaderValues(value: any) {
  if (Array.isArray(value)) {
    return value.filter((current) => !isEmptyCascaderValue(current))
  }
  if (isEmptyCascaderValue(value)) {
    return []
  }
  return [value]
}

function resolveDefaultParentValues(meta: Record<string, any> | undefined) {
  const rawValue = meta?.defaultParentValue ?? meta?.defaultParentId
  if (Array.isArray(rawValue)) {
    return rawValue.filter((current) => !isEmptyCascaderValue(current))
  }
  if (isEmptyCascaderValue(rawValue)) {
    return []
  }
  return [rawValue]
}

function isEmptyCascaderValue(value: any) {
  return value == null || value === '' || value === 0 || value === '0'
}

function buildRemoteOptionCacheKey(api: string, params: Record<string, any>) {
  return `cascader:${api}?${JSON.stringify(params)}`
}

async function fetchSelectedLeafPath(
  api: string,
  params: Record<string, any>,
  childParentField: string,
  leafValue: string
) {
  const cacheKey = buildSelectedLeafPathCacheKey(api, params)
  const cached = getCachedRemoteOptionResult<any[]>(cacheKey)
  if (cached) {
    return cached
  }

  const pending = getRemoteOptionPromise<any[]>(cacheKey)
  if (pending) {
    return pending
  }

  const nextRequest = request(api, 'get', params)
    .then((result) => {
      if (result.code !== 0 || !Array.isArray(result.data)) {
        return undefined
      }

      const selected =
        result.data.find((current: any) => String(current?.id) === leafValue) ||
        result.data[0]
      if (!selected) {
        return undefined
      }

      const selectedId = selected.id ?? leafValue
      const parentId = selected?.[childParentField]
      const nextPath = parentId ? [parentId, selectedId] : [selectedId]
      setCachedRemoteOptionResult(cacheKey, nextPath)
      return nextPath
    })
    .finally(() => {
      deleteRemoteOptionPromise(cacheKey)
    })

  setRemoteOptionPromise(cacheKey, nextRequest)
  return nextRequest
}

function buildSelectedLeafPathCacheKey(
  api: string,
  params: Record<string, any>
) {
  return `cascader-selected-path:${api}?${JSON.stringify(params)}`
}

function normalizeRemoteOptions(
  rows: any[],
  childLevel: boolean
): CascaderOption[] {
  return rows.map((current: any) => ({
    ...current,
    id: current?.id,
    value: String(current?.value ?? ''),
    leaf:
      childLevel ||
      current?.leaf === true ||
      current?.leaf === 1 ||
      current?.leaf === '1',
  }))
}

function resolveRowRelation(
  row: Record<string, any> | undefined,
  valuePath?: string
) {
  if (!row) {
    return undefined
  }

  const relationPath = inferRelationPath(valuePath)
  if (!relationPath) {
    return undefined
  }

  const normalizedPath = relationPath.replace(/^form\./, '')
  const relation = getByPath(row, normalizedPath)
  return relation && typeof relation === 'object' ? relation : undefined
}

function resolveLeafValueMode(meta: Record<string, any> | undefined) {
  const mode = String(meta?.valueMode || meta?.saveMode || '')
    .trim()
    .toLowerCase()
  return mode === 'leaf' || mode === 'last'
}

function resolveFilterPathValue(
  path: string,
  data: Record<string, any>,
  state: Record<string, any>
) {
  const { scope, key } = resolvePath(path)
  return scope === 'state' ? getByPath(state, key) : getByPath(data, key)
}

function isSameCascaderValues(left: any[], right: any[]) {
  if (left.length !== right.length) {
    return false
  }
  return left.every(
    (current, index) => String(current) === String(right[index])
  )
}

function isSameLabelValues(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }
  return left.every((current, index) => current === right[index])
}

function resolveFallbackLabels(
  store: NodeItemProps['store'],
  item: NodeItemProps['item'],
  labelTarget: string
) {
  if (labelTarget) {
    const current = store.getState().getValueByPath(labelTarget)
    if (Array.isArray(current) && current.length > 0) {
      return current.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    }
  }

  const relationPath = inferRelationPath(item.value)
  if (!relationPath) {
    return []
  }

  const current = store.getState().getValueByPath(relationPath)
  if (!Array.isArray(current)) {
    return []
  }

  return current
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        const label = entry.name ?? entry.value ?? entry.label ?? entry.id
        return String(label ?? '').trim()
      }
      return String(entry ?? '').trim()
    })
    .filter(Boolean)
}
