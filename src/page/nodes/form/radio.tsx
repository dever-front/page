/**
 * Form/Radio.tsx - 单选组
 */
import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import type { NodeItemProps } from '../../nodes'

export function FormRadio({ item, value, setValue, option, optionLoading }: NodeItemProps) {
  const options = option || []
  const optionDirection = item.meta?.optionDirection === 'vertical' ? 'vertical' : 'horizontal'

  if (optionLoading && options.length === 0) {
    return <p className="text-sm text-muted-foreground">正在加载选项...</p>
  }

  return (
    <RadioGroup
      id={item.id}
      value={value != null ? String(value) : ''}
      disabled={!!item.meta?.disabled}
      onValueChange={(val) => setValue(val)}
      className={cn(
        optionDirection === 'vertical'
          ? 'flex flex-col gap-2'
          : 'flex flex-wrap items-center gap-x-6 gap-y-2',
        item.meta?.controlClassName
      )}
    >
      {options.map((opt) => (
        <div key={String(opt.id)} className="flex items-center gap-2.5">
          <RadioGroupItem value={String(opt.id)} id={`${item.id}-${opt.id}`} />
          <Label htmlFor={`${item.id}-${opt.id}`} className="font-normal">
            {opt.value}
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}
