import {
  Check,
  Download,
  Eye,
  FileImage,
  FileText,
  Music4,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FirstFrameVideo } from '@/components/media/first-frame-video'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useElementInView } from '@/hooks/use-element-in-view'
import { downloadUploadFile, type UploadFileItem } from '@/lib/upload'
import { cn } from '@/lib/utils'
import {
  formatUploadSize,
  isPreviewableResource,
  resolveResourcePreviewKind,
  type ResourceCategoryItem,
} from '@/lib/resource'

type ResourceCardProps = {
  item: UploadFileItem
  selected?: boolean
  selectable?: boolean
  density?: 'default' | 'compact'
  actionMode?: 'picker' | 'manager'
  categories?: ResourceCategoryItem[]
  allowCategoryAssign?: boolean
  categoryUpdating?: boolean
  onSelect?: (item: UploadFileItem) => void
  onPreview?: (item: UploadFileItem) => void
  onCategoryChange?: (item: UploadFileItem, categoryId: string) => void
}

const EMPTY_CATEGORY_VALUE = '__none__'

export function ResourceCard({
  item,
  selected = false,
  selectable = false,
  density = 'default',
  actionMode = 'picker',
  categories = [],
  allowCategoryAssign = false,
  categoryUpdating = false,
  onSelect,
  onPreview,
  onCategoryChange,
}: ResourceCardProps) {
  const previewKind = resolveResourcePreviewKind(item)
  const compact = density === 'compact'
  const [previewRef, previewVisible] = useElementInView<HTMLDivElement>()
  const previewUrl =
    previewVisible && previewKind === 'image'
      ? String(item.thumbnail || item.url || '').trim()
      : previewVisible && previewKind === 'video'
        ? String(item.url || item.download || item.open_url || '').trim()
        : ''
  const categoryLabel = resolveCategoryLabel(item.category_id, categories)
  const previewable = isPreviewableResource(item) && !!onPreview
  const previewButtonClassName =
    actionMode === 'picker'
      ? 'opacity-100'
      : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
  const showManagerActions = actionMode === 'manager' && (previewable || !!item.download || !!item.url)

  return (
    <article
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      className={cn(
        'group overflow-hidden rounded-2xl border bg-background transition-all',
        selectable
          ? 'cursor-pointer hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
          : 'hover:border-border/80 hover:shadow-sm',
        selected && 'border-primary shadow-sm ring-2 ring-primary/15',
        compact && 'rounded-xl'
      )}
      onClick={() => onSelect?.(item)}
      onKeyDown={(event) => {
        if (!selectable) {
          return
        }
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.preventDefault()
        onSelect?.(item)
      }}
    >
      <div className="relative">
        <div
          ref={previewRef}
          className={cn(
            'flex items-center justify-center overflow-hidden bg-muted/30',
            compact ? 'aspect-[4/5]' : 'aspect-[4/3]',
            previewable && actionMode === 'manager' && 'cursor-zoom-in'
          )}
          onClick={(event) => {
            if (!previewable || actionMode !== 'manager') {
              return
            }
            event.stopPropagation()
            onPreview?.(item)
          }}
        >
          {previewKind === 'image' && previewUrl ? (
            <img
              src={previewUrl}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : previewKind === 'video' && previewUrl ? (
            <FirstFrameVideo
              src={previewUrl}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              {renderResourceIcon(item)}
              <span className="text-xs">{String(item.kind || 'file').toUpperCase()}</span>
            </div>
          )}
        </div>

        {showManagerActions || (previewable && actionMode !== 'manager') ? (
          <div
            className={cn(
              'absolute left-2 flex items-center gap-2',
              compact ? 'top-2' : 'top-3'
            )}
          >
            {previewable ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className={cn(
                  compact ? 'size-7 shadow-sm transition' : 'size-8 shadow-sm transition',
                  previewButtonClassName
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  onPreview?.(item)
                }}
              >
                <Eye className="size-4" />
              </Button>
            ) : null}
            {actionMode === 'manager' ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className={cn(
                  compact ? 'size-7 shadow-sm transition' : 'size-8 shadow-sm transition',
                  previewButtonClassName
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  void downloadUploadFile(item)
                }}
              >
                <Download className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : null}

        {selectable ? (
          <div className={cn('absolute', compact ? 'right-2 top-2' : 'right-3 top-3')}>
            <span
              className={cn(
                'flex items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm',
                compact ? 'size-7' : 'size-6',
                selected && 'border-primary bg-primary text-primary-foreground'
              )}
            >
              <Check className="size-3.5" />
            </span>
          </div>
        ) : null}
      </div>

      <div className={cn('p-4', compact ? 'space-y-2 p-3' : 'space-y-3')}>
        <div className="space-y-1">
          <div className="line-clamp-1 text-sm font-medium text-foreground">{item.name}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatUploadSize(Number(item.size || 0))}</span>
            {item.ext ? <span>{String(item.ext).replace(/^\./, '').toUpperCase()}</span> : null}
            {!compact && item.created_at ? <span>{formatCreatedAt(item.created_at)}</span> : null}
          </div>
        </div>

        {!compact ? (
          <div className="flex min-h-6 flex-wrap items-center gap-2">
            {categoryLabel ? <Badge variant="secondary">{categoryLabel}</Badge> : null}
            {item.biz_name || item.biz_key ? (
              <span className="truncate text-xs text-muted-foreground">
                {String(item.biz_name || item.biz_key).trim()}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          {allowCategoryAssign && categories.length > 0 ? (
            <div
              className={cn('min-w-0 flex-1')}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Select
                value={String(item.category_id || '').trim() || EMPTY_CATEGORY_VALUE}
                onValueChange={(value) =>
                  onCategoryChange?.(
                    item,
                    value === EMPTY_CATEGORY_VALUE ? '' : String(value || '').trim()
                  )
                }
                disabled={categoryUpdating}
              >
                <SelectTrigger
                  className={compact ? 'h-8 w-full min-w-0' : 'h-8 min-w-[9rem]'}
                >
                  <SelectValue placeholder="设置分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_CATEGORY_VALUE}>未分类</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function renderResourceIcon(item: UploadFileItem) {
  switch (String(item.kind || '').trim()) {
    case 'image':
      return <FileImage className="size-9" />
    case 'video':
      return <Video className="size-9" />
    case 'audio':
      return <Music4 className="size-9" />
    default:
      return <FileText className="size-9" />
  }
}

function formatCreatedAt(value: string) {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }

  const [date] = text.split(/[ T]/)
  return date || text
}

function resolveCategoryLabel(categoryID: string | number | undefined, categories: ResourceCategoryItem[]) {
  const normalizedID = String(categoryID || '').trim()
  if (!normalizedID) {
    return ''
  }

  const matched = categories.find((item) => String(item.id).trim() === normalizedID)
  return matched?.value || normalizedID
}
