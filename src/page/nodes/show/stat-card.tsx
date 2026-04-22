import { TrendingDown, TrendingUp } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { resolveLucideIcon } from '@/lib/icon'
import { cn, formatDisplayValue } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

type StatCardMeta = {
  title?: string
  description?: string
  icon?: string
  format?: string
  trend?: string
  trendType?: 'up' | 'down' | 'neutral'
}

type StatCardValue = {
  value?: unknown
  title?: string
  description?: string
  icon?: string
  trend?: string
  trendType?: 'up' | 'down' | 'neutral'
}

export function ShowStatCard({ item, value }: NodeItemProps) {
  const meta = (item.meta ?? {}) as StatCardMeta
  const record = normalizeStatValue(value)
  const title = record.title || meta.title || item.name || ''
  const description = record.description || meta.description || ''
  const trend = record.trend || meta.trend || ''
  const trendType = record.trendType || meta.trendType || 'neutral'
  const displayValue = formatDisplayValue(record.value, meta.format)
  const Icon = resolveLucideIcon(record.icon || meta.icon || '')
  const TrendIcon = trendType === 'down' ? TrendingDown : TrendingUp

  return (
    <Card className={cn('overflow-hidden', item.className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon ? (
          <CardAction>
            <div className="rounded-md border bg-background p-2 text-muted-foreground">
              <Icon className="size-4" />
            </div>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-semibold tracking-tight">
          {displayValue || '0'}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{description}</span>
          {trend ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                trendType === 'up' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                trendType === 'down' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                trendType === 'neutral' && 'bg-muted text-muted-foreground'
              )}
            >
              {trendType !== 'neutral' ? <TrendIcon className="size-3" /> : null}
              {trend}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function normalizeStatValue(value: unknown): StatCardValue {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as StatCardValue
  }
  return { value }
}
