import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { matchConditionValue } from '@/lib/condition'
import { runActions } from '@/lib/action'
import { resolveLucideIcon } from '@/lib/icon'
import { withBackNavigationSearch } from '@/lib/navigation'
import { getByPath } from '@/lib/path'
import { stripRouterBasePath } from '@/lib/router-path'
import { cn } from '@/lib/utils'
import type { PageStore } from '@/lib/store'

type ActionButtonProps = {
  buttonMeta: Record<string, any>
  store: PageStore
  record?: Record<string, any>
  context?: Record<string, any>
  defaultVariant?: string
  defaultSize?: string
}

export function ActionButton({
  buttonMeta,
  store,
  record,
  context,
  defaultVariant = 'ghost',
  defaultSize = 'sm',
}: ActionButtonProps) {
  const navigate = useNavigate()
  const actionContext = context ?? (record ? { row: record } : undefined)

  if (isActionButtonHidden(buttonMeta, record, actionContext)) {
    return null
  }

  const Icon = resolveLucideIcon(buttonMeta?.icon)
  const hasIcon = !!Icon
  const buttonLabel = buttonMeta?.label || buttonMeta?.name
  const hasLabel = !!buttonLabel

  const handleClick = async () => {
    if (buttonMeta?.to && (buttonMeta?.open || 'path') === 'modal') {
      store.getState().setPageState(buttonMeta?.routeKey || 'dialog.route', buttonMeta.to)
      store.getState().setPageState(buttonMeta?.stateKey || 'dialog.open', true)
      return
    }

    if (buttonMeta?.to && (buttonMeta?.open || 'path') === 'drawer') {
      store.getState().setPageState(buttonMeta?.routeKey || 'drawer.route', buttonMeta.to)
      store.getState().setPageState(buttonMeta?.stateKey || 'drawer.open', true)
      return
    }

    if (buttonMeta?.to) {
      const searchParam = String(buttonMeta?.searchParam || 'id').trim() || 'id'
      const searchValue = resolveRecordSearchValue(record, buttonMeta?.searchField)
      const search =
        searchValue == null
          ? undefined
          : { [searchParam]: String(searchValue) }

      navigate({
        to: stripRouterBasePath(buttonMeta.to),
        search: withBackNavigationSearch(
          search,
          buttonMeta?.withBack ?? buttonMeta?.meta?.withBack
        ),
      })
      return
    }

    if (buttonMeta?.action?.click) {
      await runActions(store, buttonMeta.action.click, actionContext)
    }
  }

  const button = (
    <Button
      type="button"
      variant={buttonMeta?.variant || defaultVariant}
      size={hasIcon && !hasLabel ? undefined : buttonMeta?.size || defaultSize}
      className={cn(
        hasIcon && !hasLabel && getIconOnlyButtonClassName(buttonMeta?.size),
        buttonMeta?.className
      )}
      onClick={() => void handleClick()}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {hasLabel ? <span>{buttonLabel}</span> : null}
    </Button>
  )

  if (buttonMeta?.description) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent sideOffset={8}>{buttonMeta.description}</TooltipContent>
      </Tooltip>
    )
  }

  return button
}

function isActionButtonHidden(
  buttonMeta: Record<string, any>,
  record?: Record<string, any>,
  context?: Record<string, any>
) {
  const showWhen = readConditionList(buttonMeta?.showWhen ?? buttonMeta?.meta?.showWhen)
  if (
    showWhen.length > 0 &&
    !matchButtonConditions(
      showWhen,
      buttonMeta?.showCondition ?? buttonMeta?.meta?.showCondition,
      record,
      context
    )
  ) {
    return true
  }

  const hiddenWhen = readConditionList(buttonMeta?.hiddenWhen ?? buttonMeta?.meta?.hiddenWhen)
  return matchButtonConditions(
    hiddenWhen,
    buttonMeta?.hiddenCondition ?? buttonMeta?.meta?.hiddenCondition,
    record,
    context
  )
}

function readConditionList(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(isConditionRecord)
  }
  return isConditionRecord(value) ? [value] : []
}

function isConditionRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function matchButtonConditions(
  conditions: Record<string, any>[],
  conditionMode: unknown,
  record?: Record<string, any>,
  context?: Record<string, any>
) {
  if (conditions.length === 0) {
    return false
  }

  const results = conditions.map((condition) =>
    matchButtonCondition(condition, record, context)
  )
  return conditionMode === 'any' ? results.some(Boolean) : results.every(Boolean)
}

function matchButtonCondition(
  condition: Record<string, any>,
  record?: Record<string, any>,
  context?: Record<string, any>
) {
  const path = String(condition.path || '').trim()
  const current = resolveButtonConditionValue(path, record, context)
  return matchConditionValue(
    current,
    condition.operator ?? 'equals',
    condition.value
  )
}

function resolveButtonConditionValue(
  path: string,
  record?: Record<string, any>,
  context?: Record<string, any>
) {
  if (!path) {
    return undefined
  }

  const normalized = path.startsWith('$') ? path.slice(1) : path
  if (normalized.startsWith('row.')) {
    return getByPath(context?.row ?? record, normalized.slice(4))
  }
  if (normalized.startsWith('record.')) {
    return getByPath(record, normalized.slice(7))
  }

  const recordValue = getByPath(record, normalized)
  if (recordValue !== undefined) {
    return recordValue
  }

  return getByPath(context, normalized)
}

function resolveRecordSearchValue(
  record?: Record<string, any>,
  searchField?: string
) {
  if (!record) {
    return undefined
  }

  const field = String(searchField || '').trim()
  if (!field) {
    return record.id
  }

  return getByPath(record, field)
}

function getIconOnlyButtonClassName(size?: string) {
  switch (size) {
    case 'lg':
      return 'size-10 rounded-xl'
    case 'sm':
      return 'size-8 rounded-xl'
    default:
      return 'size-9 rounded-xl'
  }
}
