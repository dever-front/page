import { useState, type ComponentProps } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { runActionsWithResult } from '@/lib/action'
import { toastActionResult } from '@/lib/action-toast'
import { matchConditionValue } from '@/lib/condition'
import { resolveLucideIcon } from '@/lib/icon'
import {
  buildStoreBackNavigationHref,
  withBackNavigationSearch,
} from '@/lib/navigation'
import { getByPath } from '@/lib/path'
import { stripRouterBasePath } from '@/lib/router-path'
import type { ActionConfig } from '@/lib/schema'
import type { PageStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/confirm-dialog'

type ActionButtonProps = {
  buttonMeta: ActionButtonMeta
  store: PageStore
  record?: ActionButtonRecord
  context?: ActionButtonContext
  defaultVariant?: ButtonVariant
  defaultSize?: ButtonSize
}

type ButtonVariant = ComponentProps<typeof Button>['variant']
type ButtonSize = ComponentProps<typeof Button>['size']
type ActionButtonRecord = Record<string, unknown>
type ActionButtonContext = Record<string, unknown>
type ActionButtonAction = string | ActionConfig

type ActionButtonMeta = {
  action?: {
    click?: ActionButtonAction | ActionButtonAction[]
  }
  className?: string
  confirm?: unknown
  description?: string
  disabled?: boolean
  errorMessage?: unknown
  hiddenCondition?: unknown
  hiddenWhen?: unknown
  icon?: string
  id?: string
  key?: string
  label?: string
  meta?: {
    confirm?: unknown
    hiddenCondition?: unknown
    hiddenWhen?: unknown
    showCondition?: unknown
    showWhen?: unknown
    withBack?: unknown
  }
  name?: string
  open?: string
  routeKey?: string
  searchField?: string
  searchParam?: string
  showCondition?: unknown
  showWhen?: unknown
  size?: ButtonSize
  stateKey?: string
  successMessage?: unknown
  to?: string
  variant?: ButtonVariant
  withBack?: unknown
}

type ActionButtonConfirmMeta = {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const actionContext = {
    ...(context || {}),
    ...(record ? { row: record } : {}),
    item: buttonMeta,
    itemKey: buttonMeta.key || buttonMeta.id || buttonMeta.stateKey,
  }

  if (isActionButtonHidden(buttonMeta, record, actionContext)) {
    return null
  }

  const Icon = resolveLucideIcon(buttonMeta?.icon)
  const hasIcon = !!Icon
  const buttonLabel = buttonMeta?.label || buttonMeta?.name
  const hasLabel = !!buttonLabel
  const confirmMeta = resolveActionButtonConfirm(buttonMeta)

  const executeAction = async () => {
    if (submitting) {
      return
    }

    setSubmitting(true)
    try {
      const success = await runButtonAction(
        buttonMeta,
        store,
        record,
        actionContext,
        navigate
      )
      if (success) {
        setConfirmOpen(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClick = async () => {
    if (submitting) {
      return
    }

    if (confirmMeta) {
      setConfirmOpen(true)
      return
    }

    await executeAction()
  }

  const button = (
    <Button
      type='button'
      variant={buttonMeta?.variant || defaultVariant}
      size={hasIcon && !hasLabel ? undefined : buttonMeta?.size || defaultSize}
      className={cn(
        hasIcon && !hasLabel && getIconOnlyButtonClassName(buttonMeta?.size),
        buttonMeta?.className
      )}
      onClick={() => void handleClick()}
      disabled={submitting || !!buttonMeta?.disabled}
    >
      {Icon ? <Icon className='size-4' /> : null}
      {hasLabel ? <span>{buttonLabel}</span> : null}
    </Button>
  )

  const wrappedButton = buttonMeta?.description ? (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent sideOffset={8}>{buttonMeta.description}</TooltipContent>
    </Tooltip>
  ) : (
    button
  )

  return (
    <>
      {wrappedButton}
      {confirmMeta ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={(open) => {
            if (submitting) {
              return
            }
            setConfirmOpen(open)
          }}
          title={confirmMeta.title || buttonMeta?.name || '确认操作'}
          desc={confirmMeta.description || '确定要执行此操作吗？'}
          confirmText={
            submitting ? '处理中...' : confirmMeta.confirmText || '确定'
          }
          cancelBtnText={confirmMeta.cancelText || '取消'}
          destructive={confirmMeta.destructive}
          isLoading={submitting}
          handleConfirm={() => void executeAction()}
        />
      ) : null}
    </>
  )
}

async function runButtonAction(
  buttonMeta: ActionButtonMeta,
  store: PageStore,
  record: ActionButtonRecord | undefined,
  actionContext: ActionButtonContext | undefined,
  navigate: ReturnType<typeof useNavigate>
) {
  if (buttonMeta?.to && (buttonMeta?.open || 'path') === 'modal') {
    store
      .getState()
      .setPageState(buttonMeta?.routeKey || 'dialog.route', buttonMeta.to)
    store.getState().setPageState(buttonMeta?.stateKey || 'dialog.open', true)
    return true
  }

  if (buttonMeta?.to && (buttonMeta?.open || 'path') === 'drawer') {
    store
      .getState()
      .setPageState(buttonMeta?.routeKey || 'drawer.route', buttonMeta.to)
    store.getState().setPageState(buttonMeta?.stateKey || 'drawer.open', true)
    return true
  }

  if (buttonMeta?.to) {
    const searchParam = String(buttonMeta?.searchParam || 'id').trim() || 'id'
    const searchValue = resolveRecordSearchValue(
      record,
      buttonMeta?.searchField
    )
    const search =
      searchValue == null ? undefined : { [searchParam]: String(searchValue) }

    navigate({
      to: stripRouterBasePath(buttonMeta.to),
      search: withBackNavigationSearch(
        search,
        buttonMeta?.withBack ?? buttonMeta?.meta?.withBack,
        {
          from: buildStoreBackNavigationHref(store),
        }
      ),
    })
    return true
  }

  if (buttonMeta?.action?.click) {
    const result = await runActionsWithResult(
      store,
      buttonMeta.action.click,
      actionContext
    )
    if (
      !result.success ||
      buttonMeta?.successMessage ||
      buttonMeta?.errorMessage
    ) {
      toastActionResult(result, {
        successMessage: buttonMeta?.successMessage,
        errorMessage: buttonMeta?.errorMessage,
        defaultSuccessMessage: '',
        defaultErrorMessage: '操作失败',
      })
    }
    return result.success
  }

  return true
}

function resolveActionButtonConfirm(buttonMeta: ActionButtonMeta) {
  const confirm = buttonMeta?.confirm ?? buttonMeta?.meta?.confirm
  if (confirm === true) {
    return {}
  }
  if (confirm && typeof confirm === 'object' && !Array.isArray(confirm)) {
    return confirm as ActionButtonConfirmMeta
  }
  return null
}

function isActionButtonHidden(
  buttonMeta: ActionButtonMeta,
  record?: ActionButtonRecord,
  context?: ActionButtonContext
) {
  const showWhen = readConditionList(
    buttonMeta?.showWhen ?? buttonMeta?.meta?.showWhen
  )
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

  const hiddenWhen = readConditionList(
    buttonMeta?.hiddenWhen ?? buttonMeta?.meta?.hiddenWhen
  )
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

function isConditionRecord(value: unknown): value is ActionButtonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function matchButtonConditions(
  conditions: ActionButtonRecord[],
  conditionMode: unknown,
  record?: ActionButtonRecord,
  context?: ActionButtonContext
) {
  if (conditions.length === 0) {
    return false
  }

  const results = conditions.map((condition) =>
    matchButtonCondition(condition, record, context)
  )
  return conditionMode === 'any'
    ? results.some(Boolean)
    : results.every(Boolean)
}

function matchButtonCondition(
  condition: ActionButtonRecord,
  record?: ActionButtonRecord,
  context?: ActionButtonContext
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
  record?: ActionButtonRecord,
  context?: ActionButtonContext
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
  record?: ActionButtonRecord,
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
