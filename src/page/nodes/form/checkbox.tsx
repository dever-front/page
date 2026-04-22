/**
 * Form/Checkbox.tsx - 多选
 */
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { NodeItemProps } from '../../nodes'

export function FormCheckbox({ item, value, setValue, option, optionLoading }: NodeItemProps) {
  const options = option || []
  const selectedValues: string[] = Array.isArray(value) ? value.map(String) : []
  const horizontal = item.meta?.orientation === 'horizontal'

  if (optionLoading && options.length === 0) {
    return <p className="text-sm text-muted-foreground">正在加载选项...</p>
  }

  const handleChange = (optId: string, checked: boolean) => {
    if (checked) {
      setValue([...selectedValues, optId])
    } else {
      setValue(selectedValues.filter((v) => v !== optId))
    }
  }

  return (
    <div className={horizontal ? 'flex flex-wrap gap-x-4 gap-y-2' : 'flex flex-col gap-2'}>
      {options.map((opt) => (
        <div key={String(opt.id)} className="flex items-center gap-2">
          <Checkbox
            id={`${item.id}-${opt.id}`}
            checked={selectedValues.includes(String(opt.id))}
            onCheckedChange={(checked) => handleChange(String(opt.id), !!checked)}
          />
          <Label htmlFor={`${item.id}-${opt.id}`} className="font-normal">
            {opt.value}
          </Label>
        </div>
      ))}
    </div>
  )
}
