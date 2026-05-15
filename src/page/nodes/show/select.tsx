import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { runActionsWithResult } from '@/lib/action'
import { reloadStorePageSchema } from '@/lib/page-schema-reload'
import { toastActionResult } from '@/lib/action-toast'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'
import { matchesOptionValue } from './option-text'

export type SelectOption = {
  id?: string | number
  value?: string
  label?: string
  color?: string
  textColor?: string
  bgColor?: string
  borderColor?: string
  className?: string
}

export type ShowSelectProps = NodeItemProps & {
  row?: Record<string, any>
  editable?: boolean
  selectOptions?: SelectOption[]
  changeAction?: any
  onValueChangeSuccess?: (nextValue: string, option: SelectOption) => void
}

export function ShowSelect({
  item,
  value,
  option,
  selectOptions,
  row,
  editable = false,
  changeAction,
  store,
  onValueChangeSuccess,
}: ShowSelectProps) {
  const [savingValue, setSavingValue] = useState<string>('')

  const normalizedOptions = useMemo(() => {
    const items = Array.isArray(selectOptions)
      ? selectOptions
      : Array.isArray(option)
        ? (option as SelectOption[])
        : []
    return items
  }, [option, selectOptions])

  const currentValue = useMemo(
    () => normalizeSelectValue(value, normalizedOptions),
    [normalizedOptions, value]
  )
  const displayText = currentValue.label || currentValue.value || ''

  const editableOptions = useMemo(() => {
    const allowValues = Array.isArray(item.meta?.editableValues)
      ? item.meta.editableValues.map((current: unknown) => String(current))
      : []

    if (allowValues.length === 0) {
      return normalizedOptions
    }

    return normalizedOptions.filter((current) =>
      allowValues.includes(String(current?.id ?? current?.value ?? ''))
    )
  }, [item.meta?.editableValues, normalizedOptions])

  const displayMode =
    String(item.meta?.display || '').trim() || (currentValue.color ? 'badge' : 'select')

  const trigger = renderTrigger({
    value: currentValue,
    displayText,
    editable,
    displayMode,
  })

  if (!editable || !changeAction || editableOptions.length === 0) {
    return trigger
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!!savingValue}
          className={cn(
            'h-auto p-0 hover:bg-transparent focus-visible:ring-0',
            displayMode === 'badge' ? 'rounded-full' : 'rounded-md'
          )}
        >
          {trigger}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[9rem]">
        {editableOptions.map((current) => {
          const optionId = String(current?.id ?? current?.value ?? '')
          const currentId = String(currentValue.id ?? currentValue.value ?? '')
          const isCurrent = optionId === currentId

          return (
            <DropdownMenuItem
              key={optionId}
              disabled={isCurrent || !!savingValue}
              onClick={async () => {
                if (!row || !optionId) return

                const confirmValues = Array.isArray(item.meta?.confirmValues)
                  ? item.meta.confirmValues.map((value: unknown) => String(value))
                  : []
                const confirmStateKey = String(item.meta?.confirmStateKey || '')
                const confirmDataKey = String(item.meta?.confirmDataKey || '')
                const rowKey = String(item.meta?.rowKey || 'id')
                const field = String(item.value || '')

                if (confirmValues.includes(optionId)) {
                  const resolvedRowKey = rowKey || 'id'
                  const resolvedConfirmStateKey =
                    confirmStateKey || buildDefaultConfirmStateKey(field)
                  const resolvedConfirmDataKey =
                    confirmDataKey || buildDefaultConfirmDataKey(field)

                  if (resolvedConfirmStateKey && resolvedConfirmDataKey && field && row) {
                    store.getState().setData(resolvedConfirmDataKey, {
                      _partial: true,
                      [resolvedRowKey]: row[resolvedRowKey],
                      [field]: optionId,
                    })
                    store.getState().setPageState(resolvedConfirmStateKey, true)
                    return
                  }

                  const nextLabel = current.label || current.value || optionId
                  const confirmMessage =
                    item.meta?.confirmMessage || `确认将值改为“${nextLabel}”吗？`

                  if (
                    typeof window !== 'undefined' &&
                    !window.confirm(confirmMessage)
                  ) {
                    return
                  }
                }

                setSavingValue(optionId)
                try {
                  const result = await runActionsWithResult(store, changeAction, {
                    row,
                    value: optionId,
                    option: current,
                  })
                  if (result.success) {
                    onValueChangeSuccess?.(optionId, current)
                    if (!onValueChangeSuccess) {
                      await refreshCurrentPage(store)
                    }
                  }
                  toastActionResult(result, {
                    successMessage: item.meta?.successMessage,
                    errorMessage: item.meta?.errorMessage,
                    defaultSuccessMessage: '操作成功',
                    defaultErrorMessage: '修改失败',
                  })
                } finally {
                  setSavingValue('')
                }
              }}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <OptionDot current={current} />
                <span>{current.label || current.value || optionId}</span>
              </span>
              {isCurrent ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function renderTrigger({
  value,
  displayText,
  editable,
  displayMode,
}: {
  value: SelectOption
  displayText: string
  editable: boolean
  displayMode: string
}) {
  if (displayMode === 'badge') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'capitalize',
          editable && 'cursor-pointer pr-1 transition-colors',
          value.className
        )}
        style={buildSelectStyle(value)}
      >
        <span>{displayText}</span>
        {editable ? <ChevronDown className="ml-1 size-3 opacity-70" /> : null}
      </Badge>
    )
  }

  return (
    <span className="inline-flex h-8 max-w-full items-center gap-2 rounded-md border bg-background px-3 text-sm text-foreground shadow-xs">
      {value.color ? <OptionDot current={value} /> : null}
      <span className="truncate">{displayText}</span>
      {editable ? <ChevronDown className="size-3.5 shrink-0 opacity-70" /> : null}
    </span>
  )
}

function normalizeSelectValue(
  value: unknown,
  options: SelectOption[]
): SelectOption {
  if (typeof value !== 'object' || value == null) {
    const matched = findSelectOption(value, options)
    if (matched) {
      return matched
    }
    return { value: String(value ?? '') }
  }

  return value as SelectOption
}

function findSelectOption(value: unknown, options: SelectOption[]) {
  return options.find((current) => matchesOptionValue(current, value))
}

function buildDefaultConfirmStateKey(field: string) {
  const normalizedField = normalizeFieldName(field)
  if (!normalizedField) {
    return ''
  }
  return `confirm.${normalizedField}Change`
}

function buildDefaultConfirmDataKey(field: string) {
  const normalizedField = normalizeFieldName(field)
  if (!normalizedField) {
    return ''
  }
  return `actionTarget.${normalizedField}ChangePayload`
}

function normalizeFieldName(field: string) {
  const last = String(field || '')
    .trim()
    .replace(/^(data|state)\./, '')
    .split('.')
    .filter(Boolean)
    .pop()

  if (!last) {
    return ''
  }

  return last.replace(/_([a-z])/g, (_, current: string) => current.toUpperCase())
}

function buildSelectStyle(current: SelectOption) {
  const accentColor = current.color
  if (!accentColor) {
    return undefined
  }

  return {
    color: current.textColor || accentColor,
    borderColor: current.borderColor || accentColor,
    backgroundColor:
      current.bgColor ||
      `color-mix(in srgb, ${accentColor} 14%, transparent)`,
  }
}

function OptionDot({ current }: { current: SelectOption }) {
  const style = current.color ? { backgroundColor: current.color } : undefined
  return <span className="size-2 rounded-full" style={style} />
}

async function refreshCurrentPage(store: NodeItemProps['store']) {
  await reloadStorePageSchema(store)
}
