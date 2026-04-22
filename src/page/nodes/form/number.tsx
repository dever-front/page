/**
 * Form/Number.tsx - 数字输入
 */
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { NodeItemProps } from '../../nodes'

export function FormNumber({ item, value, setValue, error }: NodeItemProps) {
  return (
    <Input
      id={item.id}
      type="number"
      inputMode={item.meta?.step && !Number.isInteger(Number(item.meta.step)) ? 'decimal' : 'numeric'}
      placeholder={item.placeholder}
      value={value ?? ''}
      disabled={!!item.meta?.disabled}
      autoFocus={!!item.meta?.autoFocus}
      onChange={(e) => {
        const val = e.target.value
        setValue(val === '' ? '' : Number(val))
      }}
      min={item.meta?.min}
      max={item.meta?.max}
      step={item.meta?.step}
      aria-invalid={!!error}
      className={cn(
        '[appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
        item.meta?.controlClassName
      )}
    />
  )
}
