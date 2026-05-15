import type { ComponentProps } from 'react'
import { useStore } from 'zustand'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Item } from '@/lib/schema'
import type { PageStore } from '@/lib/store'
import {
  buildAssistantFieldContext,
  buildAssistantPageContext,
  type AssistantFieldContext,
  type AssistantPageContext,
} from '@/lib/assistant/context'
import {
  runAssistantContextQuickFill,
  runAssistantQuickFill,
} from '@/lib/assistant/quick-fill'
import type { AssistantPageScope } from '@/lib/assistant/registry'
import { AssistantTaskPopover } from './task-popover'

type AssistantFieldGenerateButtonProps = {
  item: Item
  store: PageStore
  className?: string
}

type AssistantFormFillButtonProps = {
  store: PageStore
  scope?: AssistantPageScope
  route?: string
  className?: string
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  overwrite?: boolean
}

type AssistantContextFormFillButtonProps = {
  context: AssistantPageContext
  className?: string
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  disabled?: boolean
  overwrite?: boolean
  onApplyValues: (values: Record<string, unknown>) => void | Promise<void>
}

type AssistantContextFieldGenerateButtonProps = {
  context: AssistantPageContext
  field: AssistantFieldContext
  className?: string
  disabled?: boolean
  onApplyValue: (path: string, value: unknown) => void | Promise<void>
}

type AssistantQuickFillPopoverProps = {
  store: PageStore
  scope?: AssistantPageScope
  route?: string
  field?: AssistantFieldContext
  title: string
  description: string
  triggerLabel: string
  triggerClassName?: string
  triggerVariant?: ComponentProps<typeof Button>['variant']
  triggerSize?: ComponentProps<typeof Button>['size']
  iconOnly?: boolean
  overwrite?: boolean
}

type AssistantContextQuickFillPopoverProps = {
  context: AssistantPageContext
  field?: AssistantFieldContext
  title: string
  description: string
  triggerLabel: string
  triggerClassName?: string
  triggerVariant?: ComponentProps<typeof Button>['variant']
  triggerSize?: ComponentProps<typeof Button>['size']
  iconOnly?: boolean
  disabled?: boolean
  overwrite?: boolean
  onApplyField?: (path: string, value: unknown) => void | Promise<void>
  onApplyValues?: (values: Record<string, unknown>) => void | Promise<void>
}

const MAX_REFERENCE_FILES = 4

export function AssistantFieldGenerateButton({
  item,
  store,
  className,
}: AssistantFieldGenerateButtonProps) {
  const field = buildAssistantFieldContext(item)

  if (!field || item.meta?.disabled) {
    return null
  }

  return (
    <AssistantQuickFillPopover
      store={store}
      field={field}
      scope="modal"
      title={`AI 生成${field.name}`}
      description="补充一点要求，或加参考文件；不填也可以直接生成。"
      triggerLabel={`AI 生成${field.name}`}
      triggerClassName={cn('size-8 shrink-0 rounded-md text-muted-foreground', className)}
      triggerVariant="ghost"
      triggerSize="icon"
      iconOnly
      overwrite
    />
  )
}

export function AssistantFormFillButton({
  store,
  scope = 'modal',
  route,
  className,
  variant = 'outline',
  size = 'sm',
  overwrite = true,
}: AssistantFormFillButtonProps) {
  const fieldCount = useAssistantFormFieldCount(store)

  if (fieldCount === 0) {
    return null
  }

  return (
    <AssistantQuickFillPopover
      store={store}
      scope={scope}
      route={route}
      title="AI 填写当前表单"
      description="可以补充业务背景、粘贴材料，或添加文件/图片作为参考。"
      triggerLabel="AI 填写"
      triggerClassName={cn('gap-1.5', className)}
      triggerVariant={variant}
      triggerSize={size}
      overwrite={overwrite}
    />
  )
}

export function AssistantContextFormFillButton({
  context,
  className,
  variant = 'outline',
  size = 'sm',
  disabled = false,
  overwrite = true,
  onApplyValues,
}: AssistantContextFormFillButtonProps) {
  if (!context.form?.fields.length) {
    return null
  }

  return (
    <AssistantContextQuickFillPopover
      context={context}
      title="AI 填写当前表单"
      description="可以补充业务背景、粘贴材料，或添加文件/图片作为参考。"
      triggerLabel="AI 填写"
      triggerClassName={cn('gap-1.5', className)}
      triggerVariant={variant}
      triggerSize={size}
      disabled={disabled}
      overwrite={overwrite}
      onApplyValues={onApplyValues}
    />
  )
}

export function AssistantContextFieldGenerateButton({
  context,
  field,
  className,
  disabled = false,
  onApplyValue,
}: AssistantContextFieldGenerateButtonProps) {
  return (
    <AssistantContextQuickFillPopover
      context={context}
      field={field}
      title={`AI 生成${field.name}`}
      description="补充一点要求，或加参考文件；不填也可以直接生成。"
      triggerLabel={`AI 生成${field.name}`}
      triggerClassName={cn('size-8 shrink-0 rounded-md text-muted-foreground', className)}
      triggerVariant="ghost"
      triggerSize="icon"
      iconOnly
      disabled={disabled}
      overwrite
      onApplyField={onApplyValue}
    />
  )
}

function AssistantQuickFillPopover({
  store,
  scope = 'modal',
  route,
  field,
  title,
  description,
  triggerLabel,
  triggerClassName,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  iconOnly = false,
  overwrite = true,
}: AssistantQuickFillPopoverProps) {
  return (
    <AssistantTaskPopover
      title={title}
      description={description}
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      triggerVariant={triggerVariant}
      triggerSize={triggerSize}
      iconOnly={iconOnly}
      textareaPlaceholder="可选：输入补充要求、粘贴参考文案，留空则按当前表单直接生成。"
      onSubmit={async ({ instruction, references, signal, setStatus }) => {
        const result = await runAssistantQuickFill({
          store,
          scope,
          route,
          field,
          instruction,
          references,
          overwrite,
          signal,
          onStatus: setStatus,
        })
        return result.applied
      }}
      maxReferences={MAX_REFERENCE_FILES}
    />
  )
}

function AssistantContextQuickFillPopover({
  context,
  field,
  title,
  description,
  triggerLabel,
  triggerClassName,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  iconOnly = false,
  disabled = false,
  overwrite = true,
  onApplyField,
  onApplyValues,
}: AssistantContextQuickFillPopoverProps) {
  return (
    <AssistantTaskPopover
      title={title}
      description={description}
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      triggerVariant={triggerVariant}
      triggerSize={triggerSize}
      iconOnly={iconOnly}
      disabled={disabled}
      textareaPlaceholder="可选：输入补充要求、粘贴参考文案，留空则按当前表单直接生成。"
      onSubmit={async ({ instruction, references, signal, setStatus }) => {
        const result = await runAssistantContextQuickFill({
          context,
          field,
          instruction,
          references,
          overwrite,
          signal,
          onStatus: setStatus,
          onApplyField,
          onApplyValues,
        })
        return result.applied
      }}
      maxReferences={MAX_REFERENCE_FILES}
    />
  )
}

function useAssistantFormFieldCount(store: PageStore) {
  return useStore(store, (state) => {
    const context = buildAssistantPageContext({
      id: 'assistant-form-count',
      store,
      scope: 'modal',
      route: state.pagePath || state.schema.page.route || '',
    })
    return context?.form?.fields.length || 0
  })
}
