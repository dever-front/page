/**
 * Form/Radio.tsx - 单选组
 */
import { cn } from '@/lib/utils'
import { setByPath } from '@/lib/path'
import {
  normalizeClearOnChangePaths,
  normalizeFormRowFieldPath,
} from '@/lib/form-control'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import type { NodeItemProps } from '../../nodes'

export function FormRadio({
  item,
  value,
  setValue,
  option,
  optionLoading,
  store,
  row,
  setRow,
}: NodeItemProps) {
  const options = option || []
  const optionDirection = item.meta?.optionDirection === 'vertical' ? 'vertical' : 'horizontal'
  const clearPaths = normalizeClearOnChangePaths(item.meta?.clearOnChange)

  const handleValueChange = (nextValue: string) => {
    if (String(value ?? '') === String(nextValue ?? '')) {
      return
    }

    if (row && setRow) {
      const fieldPath = normalizeFormRowFieldPath(item.value)
      let nextRow = fieldPath ? setByPath(row, fieldPath, nextValue) : row

      for (const path of clearPaths) {
        const rowPath = normalizeFormRowFieldPath(path)
        if (rowPath) {
          nextRow = setByPath(nextRow, rowPath, '')
          continue
        }
        store.getState().setValueByPath(path, '')
      }

      setRow(nextRow)
      return
    }

    setValue(nextValue)
    for (const path of clearPaths) {
      store.getState().setValueByPath(path, '')
    }
  }

  if (optionLoading && options.length === 0) {
    return <p className="text-sm text-muted-foreground">正在加载选项...</p>
  }

  return (
    <RadioGroup
      id={item.id}
      value={value != null ? String(value) : ''}
      disabled={!!item.meta?.disabled}
      onValueChange={handleValueChange}
      className={cn(
        optionDirection === 'vertical'
          ? 'flex flex-col gap-2'
          : 'flex flex-wrap items-center gap-x-6 gap-y-2',
        item.meta?.controlClassName
      )}
    >
      {options.map((opt) => (
        <Label
          key={String(opt.id)}
          htmlFor={`${item.id}-${opt.id}`}
          className="flex cursor-pointer items-center gap-2.5 font-normal"
        >
          <RadioGroupItem value={String(opt.id)} id={`${item.id}-${opt.id}`} />
          <span>{opt.value}</span>
        </Label>
      ))}
    </RadioGroup>
  )
}
