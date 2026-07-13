import { Check, Circle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  isSelectedOptionValue,
  optionRequestValue,
  type PowerParam,
  type PowerParamOption,
} from './stream-request-params'

export type InteractionStepperParam = PowerParam & {
  recommendedValues: string[]
}

export function InteractionStepperChoice({
  param,
  value,
  disabled,
  customOpen,
  customValue,
  onChange,
  onCustomOpen,
  onCustomValueChange,
}: {
  param: InteractionStepperParam
  value: unknown
  disabled?: boolean
  customOpen: boolean
  customValue: string
  onChange: (value: unknown) => void
  onCustomOpen: () => void
  onCustomValueChange: (value: string) => void
}) {
  const multiple = param.type === 'multi_option'
  const selectedValues = normalizeSelectedValues(value)
  const toggleOption = (option: PowerParamOption) => {
    const optionValue = optionRequestValue(option)
    if (!multiple) {
      onChange(optionValue)
      return
    }
    const nextValues = isSelectedOptionValue(option, selectedValues)
      ? selectedValues.filter(
          (current) => !isSelectedOptionValue(option, [current])
        )
      : [...selectedValues, optionValue]
    onChange(nextValues)
  }
  const applyCustomValue = () => {
    const nextCustomValue = customValue.trim()
    if (!nextCustomValue) {
      return
    }
    if (!multiple) {
      onChange(nextCustomValue)
      return
    }
    onChange(
      selectedValues.includes(nextCustomValue)
        ? selectedValues
        : [...selectedValues, nextCustomValue]
    )
  }

  return (
    <div className='space-y-2'>
      {(param.options || []).map((option) => {
        const selected = isSelectedOptionValue(option, selectedValues)
        const recommended = isSelectedOptionValue(
          option,
          param.recommendedValues
        )
        return (
          <button
            key={String(option.id)}
            type='button'
            disabled={disabled}
            className={cn(
              'flex min-h-12 w-full items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              selected
                ? 'border-primary/30 bg-muted text-foreground'
                : 'border-border bg-background hover:bg-muted/50',
              disabled && 'cursor-not-allowed opacity-60'
            )}
            onClick={() => toggleOption(option)}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center border',
                multiple ? 'rounded-[4px]' : 'rounded-full',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input text-transparent'
              )}
            >
              {selected ? (
                <Check className='size-3.5' strokeWidth={2.5} />
              ) : (
                <Circle className='size-2 fill-current' />
              )}
            </span>
            <span className='min-w-0 flex-1 break-words text-sm leading-5'>
              {option.value}
            </span>
            {recommended ? (
              <span className='shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary'>
                推荐
              </span>
            ) : null}
          </button>
        )
      })}

      {customOpen ? (
        <div className='flex items-center gap-2 rounded-md border border-dashed p-2'>
          <Input
            autoFocus
            value={customValue}
            disabled={disabled}
            placeholder='输入自定义内容'
            className='h-9 border-0 shadow-none focus-visible:ring-0'
            onChange={(event) => onCustomValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyCustomValue()
              }
            }}
          />
          <Button
            type='button'
            variant='secondary'
            size='sm'
            disabled={disabled || !customValue.trim()}
            onClick={applyCustomValue}
          >
            确认
          </Button>
        </div>
      ) : (
        <button
          type='button'
          disabled={disabled}
          className='flex min-h-10 w-full items-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60'
          onClick={onCustomOpen}
        >
          <Plus className='size-4' />
          自定义补充
        </button>
      )}
    </div>
  )
}

function normalizeSelectedValues(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  const text = value == null ? '' : String(value).trim()
  return text ? [text] : []
}
