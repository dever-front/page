/**
 * Form/Select.tsx - 下拉选择
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useStore } from 'zustand'
import {
  hasMeaningfulRelationValue,
  inferRelationPath,
  resolveRelationLabel,
} from '@/lib/relation-field'
import {
  getRemoteSearchLayoutItems,
  resolveRemoteSearchMode,
} from '@/lib/remote-search'
import { getCurrentRouterPathname } from '@/lib/router-path'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SearchableOptionPicker } from '@/components/searchable-option-picker'
import { SelectTriggerShell } from '@/components/select-trigger-shell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, ChevronDown, Plus } from 'lucide-react'
import type { NodeItemProps } from '../../nodes'
import { findFloatingLayerContainer } from '@/lib/floating-layer'
import { resolveSelectedOptionLabels } from '@/lib/option-labels'
import {
  resolveSelectCreateOptionConfig,
  type SelectCreateOptionConfig,
} from '@/lib/select-create-option'
import type { ActionConfig, Item } from '@/lib/schema'
import { FeedbackModal } from '../feedback/modal'

export function FormSelect({
  item,
  value,
  setValue,
  option,
  optionLoading,
  ensureOptionLoaded,
  error,
  runAction,
  store,
  layoutId,
}: NodeItemProps) {
  const navigate = useNavigate()
  const options = option || []
  const isRemoteSearch = item.mode === 'search' && item.meta?.remote === true
  const searchKey = item.value?.split('.').pop()
  const layoutItems = useStore(store, (state) =>
    isRemoteSearch ? getRemoteSearchLayoutItems(state.schema, layoutId) : undefined
  )
  const remoteSearchMode = resolveRemoteSearchMode(layoutItems)
  const shouldAutoRemoteSearch = isRemoteSearch && remoteSearchMode === 'auto'
  const multiple = item.meta?.multiple === true
  const searchable = item.meta?.searchable !== false
  const clearable = item.meta?.clearable !== false
  const [open, setOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const optionSearchDebounceRef = useRef<number | null>(null)
  const shouldRemoteSearchOption =
    !!ensureOptionLoaded && item.meta?.remoteOptionSearch === true
  const fallbackLabel = useMemo(
    () => resolveSelectFallbackLabel(store, item, value),
    [item, store, value]
  )
  const createOptionConfig = useMemo(
    () => resolveSelectCreateOptionConfig(item),
    [item]
  )
  const createOptionModalItem = useMemo(
    () => buildSelectCreateOptionModalItem(item, createOptionConfig),
    [createOptionConfig, item]
  )
  const handleCreateOption = useCallback(() => {
    if (!createOptionConfig) {
      return
    }

    setOpen(false)
    store.getState().setPageState(createOptionConfig.stateKey, true)
  }, [createOptionConfig, store])
  const createOptionAction = createOptionConfig
    ? {
        label: createOptionConfig.name,
        disabled: !!item.meta?.disabled,
        onSelect: handleCreateOption,
      }
    : undefined
  const createOptionButton = createOptionAction ? (
    <div className="border-b p-1">
      <Button
        type="button"
        variant="ghost"
        disabled={createOptionAction.disabled}
        className="h-8 w-full justify-start gap-2 px-2 font-medium text-primary"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          createOptionAction.onSelect()
        }}
      >
        <Plus className="size-4" />
        <span className="truncate">{createOptionAction.label}</span>
      </Button>
    </div>
  ) : null
  const renderWithCreateOptionModal = (control: ReactNode) => {
    if (!createOptionModalItem) {
      return control
    }

    return (
      <>
        {control}
        <FeedbackModal
          item={createOptionModalItem}
          value={undefined}
          setValue={() => {}}
          option={undefined}
          runAction={runAction}
          store={store}
          layoutId={layoutId}
        />
      </>
    )
  }

  useEffect(
    () => () => {
      if (optionSearchDebounceRef.current != null) {
        window.clearTimeout(optionSearchDebounceRef.current)
      }
    },
    []
  )
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setPortalContainer(findFloatingLayerContainer(triggerRef.current))
      }
      setOpen(nextOpen)
      if (nextOpen) {
        void ensureOptionLoaded?.(undefined, value)
      }
    },
    [ensureOptionLoaded, value]
  )
  const syncRemoteSearch = useCallback(
    (nextValue: string | string[]) => {
      if (!shouldAutoRemoteSearch || !searchKey) {
        return
      }

      navigate({
        to: getCurrentRouterPathname(),
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          page: undefined,
          [searchKey]: resolveRemoteSearchQueryValue(nextValue),
        }),
      })
    },
    [navigate, searchKey, shouldAutoRemoteSearch]
  )
  const handleOptionSearchChange = useCallback(
    (keyword: string) => {
      if (!shouldRemoteSearchOption) {
        return
      }

      if (optionSearchDebounceRef.current != null) {
        window.clearTimeout(optionSearchDebounceRef.current)
      }

      optionSearchDebounceRef.current = window.setTimeout(() => {
        void ensureOptionLoaded?.(keyword)
      }, 300)
    },
    [ensureOptionLoaded, shouldRemoteSearchOption]
  )
  const commitValue = useCallback(
    (nextValue: string | string[]) => {
      setValue(nextValue)
      syncRemoteSearch(nextValue)
    },
    [setValue, syncRemoteSearch]
  )
  const clearValue = useCallback(() => {
    commitValue(multiple ? [] : '')
  }, [commitValue, multiple])

  if (multiple) {
    const values = Array.isArray(value)
      ? value.map((current) => String(current))
      : value == null || value === ''
        ? []
        : [String(value)]
    const selectedLabels = resolveSelectedOptionLabels(options, values)

    if (searchable) {
      return renderWithCreateOptionModal(
        <SearchableOptionPicker
          value={values}
          options={options}
          multiple
          placeholder={item.placeholder || '请选择'}
          fallbackLabel={fallbackLabel}
          searchPlaceholder={item.meta?.searchPlaceholder || '输入关键词筛选...'}
          disabled={!!item.meta?.disabled}
          error={!!error}
          loading={!!optionLoading}
          clearable={clearable}
          remoteSearch={shouldRemoteSearchOption}
          className={item.meta?.controlClassName}
          open={open}
          onOpenChange={handleOpenChange}
          onSearchChange={handleOptionSearchChange}
          onClear={clearValue}
          createAction={createOptionAction}
          onChange={(nextValue) => {
            commitValue(Array.isArray(nextValue) ? nextValue : [String(nextValue)])
          }}
        />
      )
    }

    return renderWithCreateOptionModal(
      <Popover open={open} onOpenChange={handleOpenChange}>
        <SelectTriggerShell
          className={item.meta?.controlClassName}
          clearable={clearable}
          hasValue={values.length > 0}
          disabled={!!item.meta?.disabled}
          onClear={clearValue}
        >
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              type="button"
              variant="outline"
              disabled={!!item.meta?.disabled}
              aria-invalid={!!error}
              className={cn(
                'relative w-full justify-between border-input bg-background px-3 pr-10 font-normal shadow-xs',
                !selectedLabels.length && !fallbackLabel && 'text-muted-foreground',
                error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
                item.meta?.controlClassName
              )}
            >
              <span className="truncate text-left">
                {selectedLabels.length > 0
                  ? selectedLabels.join(' / ')
                  : fallbackLabel || item.placeholder || '请选择'}
              </span>
              <ChevronDown className="select-trigger-chevron absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-60" />
            </Button>
          </PopoverTrigger>
        </SelectTriggerShell>
        <PopoverContent
          align="start"
          container={portalContainer}
          className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-1"
        >
          {createOptionButton}
          {options.map((opt) => {
            const optionId = String(opt.id)
            const checked = values.includes(optionId)

            return (
              <Button
                key={optionId}
                type="button"
                variant="ghost"
                className="w-full justify-start gap-2 px-2 font-normal"
                onClick={() => {
                  const nextValues = checked
                    ? values.filter((current) => current !== optionId)
                    : Array.from(new Set([...values, optionId]))
                  commitValue(nextValues)
                }}
              >
                <span className="flex-1 truncate text-left">{opt.value}</span>
                <Check
                  className={cn(
                    'ml-auto size-4 shrink-0',
                    checked ? 'opacity-100 text-primary' : 'opacity-0'
                  )}
                />
              </Button>
            )
          })}
        </PopoverContent>
      </Popover>
    )
  }

  if (searchable) {
    return renderWithCreateOptionModal(
      <SearchableOptionPicker
        value={value != null && value !== '' ? String(value) : undefined}
        options={options}
        placeholder={item.placeholder || '请选择'}
        fallbackLabel={fallbackLabel}
        searchPlaceholder={item.meta?.searchPlaceholder || '输入关键词筛选...'}
        disabled={!!item.meta?.disabled}
        error={!!error}
        loading={!!optionLoading}
        clearable={clearable}
        remoteSearch={shouldRemoteSearchOption}
        className={item.meta?.controlClassName}
        open={open}
        onOpenChange={handleOpenChange}
        onSearchChange={handleOptionSearchChange}
        onClear={clearValue}
        createAction={createOptionAction}
        onChange={(nextValue) => {
          commitValue(Array.isArray(nextValue) ? nextValue[0] ?? '' : nextValue)
        }}
      />
    )
  }

  return renderWithCreateOptionModal(
    <Select
      open={open}
      value={value != null ? String(value) : ''}
      disabled={!!item.meta?.disabled}
      onOpenChange={handleOpenChange}
      onValueChange={(val) => {
        commitValue(val)
      }}
    >
      <SelectTriggerShell
        className={item.meta?.controlClassName}
        clearable={clearable}
        hasValue={value != null && value !== ''}
        disabled={!!item.meta?.disabled}
        onClear={clearValue}
      >
        <SelectTrigger
          ref={triggerRef}
          id={item.id}
          aria-invalid={!!error}
          className={cn(
            'w-full pr-11',
            error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
            item.meta?.controlClassName
          )}
        >
          <SelectValue placeholder={item.placeholder || '请选择'} />
        </SelectTrigger>
      </SelectTriggerShell>
      <SelectContent container={portalContainer}>
        {createOptionButton}
        {options.map((opt) => (
          <SelectItem key={String(opt.id)} value={String(opt.id)}>
            {opt.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function buildSelectCreateOptionModalItem(
  sourceItem: Item,
  config: SelectCreateOptionConfig | null
): Item | null {
  if (!config) {
    return null
  }

  return {
    id: `${sourceItem.id || 'select'}-create-option-modal`,
    type: 'feedback-modal',
    meta: {
      stateKey: config.stateKey,
      pageRoute: config.pageRoute,
      pageRoutePath: config.pageRoutePath,
      pageRouteQuery: config.pageRouteQuery,
      pageDataPatches: config.pageDataPatches,
      title: config.title || config.name,
      description: config.description,
      size: config.size || 'sm',
      width: config.width,
      bodyClassName: config.bodyClassName,
      footer: config.footer || {
        confirm: true,
        confirmText: '保存',
      },
      refreshParentOnSuccess: false,
    },
    action: {
      success: buildSelectCreateOptionSuccessActions(sourceItem, config),
    },
  }
}

function buildSelectCreateOptionSuccessActions(
  sourceItem: Item,
  config: SelectCreateOptionConfig
) {
  const actions: Array<string | ActionConfig> = [
    ...normalizeActionList(config.success),
    {
      type: 'increment',
      key: config.reloadPath,
    },
  ]

  if (config.selectCreated && sourceItem.value) {
    actions.push({
      type: 'data',
      key: sourceItem.value,
      value: `$result.${config.createdValuePath}`,
    })
  }

  return actions
}

function normalizeActionList(
  action?: string | ActionConfig | Array<string | ActionConfig>
) {
  if (!action) {
    return []
  }
  return Array.isArray(action) ? action : [action]
}

function resolveRemoteSearchQueryValue(value: string | string[]) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value : undefined
  }
  return value && value !== '__all__' ? value : undefined
}

function resolveSelectFallbackLabel(
  store: NodeItemProps['store'],
  item: NodeItemProps['item'],
  value: unknown
) {
  const fallbackLabelPath = String(item.meta?.fallbackLabelPath || '').trim()
  if (fallbackLabelPath && hasMeaningfulRelationValue(value)) {
    const label = store.getState().getValueByPath(fallbackLabelPath)
    if (label != null && label !== '') {
      return String(label)
    }
  }

  const valuePath = item.value
  if (!valuePath || !hasMeaningfulRelationValue(value)) {
    return ''
  }

  const relationPath = inferRelationPath(valuePath)
  if (!relationPath) {
    return ''
  }

  const relationValue = store.getState().getValueByPath(relationPath)
  if (Array.isArray(relationValue)) {
    const labels = relationValue
      .map((current) => resolveRelationLabel(current))
      .filter(Boolean)
    return labels.length > 0 ? labels : ''
  }

  return resolveRelationLabel(relationValue)
}
