import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableOptionPicker } from '@/components/searchable-option-picker'
import { inferRelationPath } from '@/lib/relation-field'
import { request } from '@/lib/request'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

type CascaderOption = {
  id: string | number
  value: string
  leaf?: boolean
}

export function FormCascader({ item, value, setValue, store, error }: NodeItemProps) {
  const api = String(item.meta?.api || '').trim()
  const selectedValues = useMemo(() => normalizeCascaderValues(value), [value])
  const selectedKeys = useMemo(
    () => selectedValues.map((current) => String(current)).join('|'),
    [selectedValues]
  )
  const placeholders = useMemo(
    () => (Array.isArray(item.meta?.placeholder) ? item.meta.placeholder.map(String) : []),
    [item.meta?.placeholder]
  )
  const levelSearchPlaceholders = useMemo(() => {
    if (Array.isArray(item.meta?.searchPlaceholder)) {
      return item.meta.searchPlaceholder.map(String)
    }
    return []
  }, [item.meta?.searchPlaceholder])
  const sharedSearchPlaceholder = String(
    Array.isArray(item.meta?.searchPlaceholder) ? '' : item.meta?.searchPlaceholder || ''
  ).trim()
  const labelTarget = String(item.meta?.labelTarget || '').trim()
  const searchable = item.meta?.searchable !== false
  const fallbackLabels = useMemo(
    () => resolveFallbackLabels(store, item, labelTarget),
    [item, labelTarget, store]
  )
  const [levels, setLevels] = useState<CascaderOption[][]>([])
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null)
  const cacheRef = useRef(new Map<string, CascaderOption[]>())

  const buildParams = useCallback(
    (parentId: any) => {
      const params: Record<string, any> = {
        type: String(item.meta?.type || 'model').trim() || 'model',
        use: String(item.meta?.use || '').trim(),
        parentField: String(item.meta?.parentField || 'parent_id').trim() || 'parent_id',
        parentId,
        rootValue: item.meta?.rootValue ?? 0,
        valueField: String(item.meta?.valueField || 'id').trim() || 'id',
        labelField: String(item.meta?.labelField || 'name').trim() || 'name',
      }
      const leafField = String(item.meta?.leafField || 'leaf').trim()
      const order = String(item.meta?.order || '').trim()
      if (leafField) {
        params.leafField = leafField
      }
      if (order) {
        params.order = order
      }
      return params
    },
    [
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
      const params = buildParams(parentId)
      const cacheKey = `${api}?${JSON.stringify(params)}`
      const cached = cacheRef.current.get(cacheKey)
      if (cached) {
        return cached
      }

      setLoadingLevel(level)
      try {
        const result = await request(api, 'get', params)
        if (result.code !== 0 || !Array.isArray(result.data)) {
          return []
        }

        const nextOptions = result.data.map((current: any) => ({
          id: current?.id,
          value: String(current?.value ?? ''),
          leaf: current?.leaf === true || current?.leaf === 1 || current?.leaf === '1',
        }))
        cacheRef.current.set(cacheKey, nextOptions)
        return nextOptions
      } finally {
        setLoadingLevel((current) => (current === level ? null : current))
      }
    },
    [api, buildParams]
  )

  const syncSelectedLabels = useCallback(
    (items: string[]) => {
      if (!labelTarget) {
        return
      }
      const current = store.getState().getValueByPath(labelTarget)
      const currentItems = Array.isArray(current) ? current.map((item) => String(item)) : []
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
      if (nextLevels[0]?.length && !isSameCascaderValues(selectedValues, validValues)) {
        setValue(validValues)
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
    selectedKeys,
    setValue,
    syncSelectedLabels,
  ])

  return (
    <div className="flex flex-wrap gap-2">
      {levels.length === 0 ? (
        <div
          className={cn(
            'flex h-10 min-w-[10rem] max-w-[14rem] items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-xs',
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
      {levels.map((options, level) => {
        if (!options.length) {
          return null
        }

        const currentValue = selectedValues[level]
        const placeholder =
          placeholders[level] || (level === 0 ? item.placeholder || '请选择' : `请选择第 ${level + 1} 级`)
        const searchPlaceholder =
          levelSearchPlaceholders[level] ||
          sharedSearchPlaceholder ||
          (placeholders[level] ? `输入${placeholders[level]}筛选...` : '输入关键词筛选...')

        if (searchable) {
          return (
            <SearchableOptionPicker
              key={`level-${level}`}
              value={currentValue != null ? String(currentValue) : undefined}
              options={options}
              placeholder={loadingLevel === level ? '正在加载...' : placeholder}
              searchPlaceholder={searchPlaceholder}
              emptyText="未找到匹配地区"
              disabled={!!item.meta?.disabled}
              error={!!error}
              className={cn(
                'min-w-[10rem] max-w-[14rem]',
                item.meta?.controlClassName
              )}
              onChange={(nextValue) => {
                const nextSelectedValue = Array.isArray(nextValue) ? nextValue[0] : nextValue
                const selected = options.find(
                  (current) => String(current.id) === String(nextSelectedValue)
                )
                if (!selected) {
                  return
                }
                const nextValues = [...selectedValues.slice(0, level), selected.id]
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
              const selected = options.find((current) => String(current.id) === nextValue)
              if (!selected) {
                return
              }
              const nextValues = [...selectedValues.slice(0, level), selected.id]
              setValue(nextValues)
            }}
          >
            <SelectTrigger
              aria-invalid={!!error}
              className={cn(
                'min-w-[10rem] max-w-[14rem]',
                error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
                item.meta?.controlClassName
              )}
            >
              <SelectValue placeholder={loadingLevel === level ? '正在加载...' : placeholder} />
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
    return value.filter((current) => current != null && current !== '')
  }
  if (value == null || value === '') {
    return []
  }
  return [value]
}

function isSameCascaderValues(left: any[], right: any[]) {
  if (left.length !== right.length) {
    return false
  }
  return left.every((current, index) => String(current) === String(right[index]))
}

function isSameLabelValues(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }
  return left.every((current, index) => current === right[index])
}

function resolveFallbackLabels(store: NodeItemProps['store'], item: NodeItemProps['item'], labelTarget: string) {
  if (labelTarget) {
    const current = store.getState().getValueByPath(labelTarget)
    if (Array.isArray(current) && current.length > 0) {
      return current
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean)
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
