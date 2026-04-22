/**
 * Feedback/Alert.tsx - 提示
 * 使用 shadcn/ui Alert
 */
import { Alert as ShadcnAlert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { NodeItemProps } from '../../nodes'

export function FeedbackAlert({ item, value }: NodeItemProps) {
  return (
    <ShadcnAlert variant={item.meta?.variant || 'default'}>
      {item.name && <AlertTitle>{item.name}</AlertTitle>}
      <AlertDescription>{value || item.info || ''}</AlertDescription>
    </ShadcnAlert>
  )
}
