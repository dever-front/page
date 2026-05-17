/**
 * Show/Title.tsx - 页面标题和说明
 */
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

type TitleValue = {
  title?: unknown
  name?: unknown
  description?: unknown
  info?: unknown
  subtitle?: unknown
}

export function ShowTitle({ item, value }: NodeItemProps) {
  const title = resolveTitleText(value, item.name || item.meta?.title)
  const description = resolveDescriptionText(
    value,
    item.info || item.meta?.description || item.meta?.subtitle
  )
  const section = item.meta?.variant === 'section' || item.meta?.size === 'section'

  if (!title && !description) {
    return null
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', item.className)}>
      {title ? (
        <h1
          className={cn(
            'font-semibold tracking-tight text-foreground',
            section ? 'text-base' : 'text-xl'
          )}
        >
          {title}
        </h1>
      ) : null}
      {description ? (
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

function resolveTitleText(value: unknown, fallback: unknown) {
  if (isTitleValue(value)) {
    return stringifyTitleValue(value.title ?? value.name ?? fallback)
  }
  return stringifyTitleValue(value ?? fallback)
}

function resolveDescriptionText(value: unknown, fallback: unknown) {
  if (isTitleValue(value)) {
    return stringifyTitleValue(
      value.description ?? value.info ?? value.subtitle ?? fallback
    )
  }
  return stringifyTitleValue(fallback)
}

function isTitleValue(value: unknown): value is TitleValue {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function stringifyTitleValue(value: unknown) {
  if (value == null) {
    return ''
  }
  return String(value).trim()
}
