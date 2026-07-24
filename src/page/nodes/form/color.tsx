import { Pipette, X } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

const hexColorPattern = /^#[0-9a-f]{6}$/i
const defaultPickerColor = '#000000'

export function FormColor({
  item,
  value,
  setValue,
  error,
}: NodeItemProps) {
  const rawValue = String(value || '')
  const normalizedColor = normalizeHexColor(rawValue)
  const pickerColor =
    normalizedColor ||
    normalizeHexColor(item.meta?.pickerDefault) ||
    defaultPickerColor
  const disabled = Boolean(item.meta?.disabled)

  const normalizeValue = () => {
    if (!rawValue.trim()) {
      setValue('')
      return
    }
    if (normalizedColor && normalizedColor !== rawValue) {
      setValue(normalizedColor)
    }
  }

  return (
    <div
      className={cn(
        'flex w-full max-w-xs items-center gap-2',
        item.meta?.controlClassName
      )}
    >
      <label
        className={cn(
          'relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground shadow-xs transition focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
          error ? 'border-destructive ring-destructive/20' : 'border-input',
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer'
        )}
        title={`选择${item.name || '颜色'}`}
      >
        <span
          className='pointer-events-none inline-flex size-full items-center justify-center'
          style={
            normalizedColor ? { backgroundColor: normalizedColor } : undefined
          }
        >
          {normalizedColor ? null : <Pipette size={16} strokeWidth={1.8} />}
        </span>
        <input
          type='color'
          value={pickerColor}
          disabled={disabled}
          aria-label={`选择${item.name || '颜色'}`}
          className='absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed'
          onChange={(event) => setValue(event.target.value)}
        />
      </label>

      <Input
        id={item.id}
        name={item.id}
        value={rawValue}
        maxLength={7}
        disabled={disabled}
        placeholder={item.placeholder || '#RRGGBB'}
        autoComplete='off'
        autoCorrect='off'
        autoCapitalize='none'
        spellCheck={false}
        aria-invalid={Boolean(error)}
        className={cn(
          'h-9 min-w-0 flex-1 font-mono text-xs uppercase tracking-normal',
          error &&
            'border-destructive ring-destructive/20 focus-visible:ring-destructive/30'
        )}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          setValue(event.target.value)
        }
        onBlur={normalizeValue}
      />

      <button
        type='button'
        disabled={disabled || !rawValue}
        aria-label={`清除${item.name || '颜色'}`}
        title={`清除${item.name || '颜色'}`}
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground shadow-xs transition hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none',
          !rawValue && 'invisible'
        )}
        onClick={() => setValue('')}
      >
        <X size={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}

function normalizeHexColor(value: unknown) {
  const color = String(value || '').trim().toLowerCase()
  return hexColorPattern.test(color) ? color : ''
}
