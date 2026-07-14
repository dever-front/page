/**
 * Form/Textarea.tsx - 多行文本输入
 */
import { useMemo } from 'react'
import { useComposedTextControl } from '@/hooks/use-composed-text-control'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { AssistantFieldGenerateButton } from '@/components/assistant/form-actions'
import type { NodeItemProps } from '../../nodes'

export function FormTextarea({
  item,
  value,
  setValue,
  error,
  store,
  assistantAdornment,
}: NodeItemProps) {
  const textControl = useComposedTextControl<HTMLTextAreaElement>(value, setValue)
  const maxLength = Number(item.meta?.maxLength || 0)
  const showCount = item.meta?.showCount === true || maxLength > 0
  const currentLength = useMemo(
    () => textControl.value.length,
    [textControl.value]
  )

  return (
    <div className="min-w-0 w-full space-y-2">
      <div className="relative">
        <Textarea
          id={item.id}
          name={item.id}
          placeholder={item.placeholder}
          value={textControl.value}
          disabled={!!item.meta?.disabled}
          rows={item.meta?.rows || 4}
          maxLength={maxLength > 0 ? maxLength : undefined}
          onChange={textControl.onChange}
          onCompositionStart={textControl.onCompositionStart}
          onCompositionEnd={textControl.onCompositionEnd}
          aria-invalid={!!error}
          className={cn(
            'min-h-28 w-full min-w-0 resize-y rounded-xl border-border/70 bg-background/80 px-3.5 py-3 pr-11 text-sm leading-6 shadow-xs',
            'placeholder:text-muted-foreground/80 focus-visible:ring-4',
            error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/25'
          )}
        />
        {item.mode === 'form' ? (
          assistantAdornment !== undefined ? (
            assistantAdornment
          ) : (
            <AssistantFieldGenerateButton
              item={item}
              store={store}
              className="absolute right-2 top-2 bg-background/80"
            />
          )
        ) : null}
      </div>
      {showCount ? (
        <div className="flex justify-end text-[11px] text-muted-foreground">
          {maxLength > 0 ? `${currentLength}/${maxLength}` : `${currentLength} 字`}
        </div>
      ) : null}
    </div>
  )
}
