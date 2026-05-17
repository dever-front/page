/**
 * Show/Rich.tsx - 富文本展示
 */
import { RichTextView } from '@/components/rich-text-view'
import type { NodeItemProps } from '../../nodes'

export function ShowRich({ item, value }: NodeItemProps) {
  if (value == null) return null
  const preview = item.meta?.preview === true || item.meta?.variant === 'preview'

  return <RichTextView value={value} preview={preview} className={item.className} />
}
