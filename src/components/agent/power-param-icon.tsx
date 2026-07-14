import { Settings2, type LucideProps } from 'lucide-react'
import { resolveLucideIcon } from '@/lib/icon'

export function PowerParamIcon({
  name,
  ...props
}: LucideProps & { name?: string }) {
  const iconName = String(name || '').trim()
  const Icon = resolveLucideIcon(iconName) || Settings2
  return <Icon {...props} />
}
