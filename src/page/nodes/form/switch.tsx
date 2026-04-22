/**
 * Form/Switch.tsx - 开关
 */
import { Switch } from '@/components/ui/switch'
import type { NodeItemProps } from '../../nodes'

export function FormSwitch({ item, value, setValue }: NodeItemProps) {
  const trueValue = item.meta?.trueValue ?? true
  const falseValue = item.meta?.falseValue ?? false
  const checked = String(value ?? '') === String(trueValue)

  return (
    <Switch
      id={item.id}
      checked={checked}
      onCheckedChange={(checked) => setValue(checked ? trueValue : falseValue)}
    />
  )
}
