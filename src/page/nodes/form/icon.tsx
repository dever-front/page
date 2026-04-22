import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { resolveLucideIcon } from '@/lib/icon'
import { getLucideIconCatalog, lucideIconCategories } from '@/lib/icon-catalog'
import type { NodeItemProps } from '../../nodes'

const allIcons = getLucideIconCatalog()
const ICON_PAGE_SIZE = 30

export function FormIcon({ item, value, setValue, error }: NodeItemProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(lucideIconCategories[0]?.key ?? 'layout')
  const [visibleCount, setVisibleCount] = useState(ICON_PAGE_SIZE)
  const deferredQuery = useDeferredValue(query)

  const currentName = String(value ?? '').trim()
  const CurrentIcon = resolveLucideIcon(currentName)

  const filteredIcons = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase()

    return allIcons.filter((current) => {
      if (current.category !== category) {
        return false
      }
      if (!keyword) {
        return true
      }
      return current.name.includes(keyword)
    })
  }, [category, deferredQuery])

  const visibleIcons = useMemo(
    () => filteredIcons.slice(0, visibleCount),
    [filteredIcons, visibleCount]
  )

  useEffect(() => {
    setVisibleCount(ICON_PAGE_SIZE)
  }, [category, deferredQuery, open])

  return (
    <>
      <div className="flex w-full flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!!item.meta?.disabled}
          aria-invalid={!!error}
          className={cn(
            'w-full justify-between',
            !currentName && 'text-muted-foreground',
            error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
            item.meta?.controlClassName
          )}
          onClick={() => setOpen(true)}
          >
            <span className="flex min-w-0 items-center gap-2">
              {CurrentIcon ? (
                <span className="inline-flex size-7 items-center justify-center rounded-md border bg-muted/20">
                  <CurrentIcon className="size-4" />
              </span>
            ) : null}
            <span className="truncate">
              {currentName || item.placeholder || '请选择图标'}
            </span>
          </span>
          <span className="ml-3 flex items-center gap-1">
            {currentName ? (
              <span
                role="button"
                tabIndex={0}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setValue('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    setValue('')
                  }
                }}
              >
                <X className="size-4" />
              </span>
            ) : null}
            <ChevronDown className="size-4 shrink-0 opacity-60" />
          </span>
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[92vw] gap-0 p-0 sm:max-w-[38rem]">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle>选择图标</SheetTitle>
            <SheetDescription>
              按分类或名称筛选 Lucide 图标，点击后会自动写回当前字段。
            </SheetDescription>
          </SheetHeader>

          <div className="border-b px-5 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索图标名称"
                className="pl-9 pr-9"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b px-5 py-3">
            {lucideIconCategories.map((current) => (
              <Button
                key={current.key}
                type="button"
                variant={category === current.key ? 'default' : 'outline'}
                size="sm"
                className="h-8 rounded-full px-3"
                onClick={() => setCategory(current.key)}
              >
                {current.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between border-b px-5 py-3 text-xs text-muted-foreground">
            <span>共 {filteredIcons.length} 个图标</span>
            <span className="flex items-center gap-2">
              {currentName ? (
                <>
                  <span>{`当前已选：${currentName}`}</span>
                  {CurrentIcon ? (
                    <span className="inline-flex size-5 items-center justify-center rounded-md border bg-muted/20 text-foreground">
                      <CurrentIcon className="size-3.5" />
                    </span>
                  ) : null}
                </>
              ) : (
                <span>滚动到底部会自动加载更多</span>
              )}
            </span>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto"
            onScroll={(event) => {
              const element = event.currentTarget
              const distanceToBottom =
                element.scrollHeight - element.scrollTop - element.clientHeight

              if (
                distanceToBottom < 80 &&
                filteredIcons.length > visibleIcons.length
              ) {
                setVisibleCount((current) =>
                  Math.min(current + ICON_PAGE_SIZE, filteredIcons.length)
                )
              }
            }}
          >
            {visibleIcons.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 p-4 xl:grid-cols-5">
                {visibleIcons.map((current) => {
                  const Icon = resolveLucideIcon(current.name)
                  if (!Icon) {
                    return null
                  }

                  const active = current.name === currentName

                  return (
                    <button
                      key={current.name}
                      type="button"
                      onClick={() => {
                        setValue(current.name)
                        setOpen(false)
                      }}
                      className={cn(
                        'group relative flex flex-col items-center gap-2 rounded-lg border px-2 py-3 text-center transition',
                        active
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/40 hover:bg-muted/40'
                      )}
                      title={current.name}
                    >
                      {active ? (
                        <span className="absolute right-2 top-2 inline-flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                      <span className="inline-flex size-10 items-center justify-center rounded-lg border bg-background shadow-xs">
                        <Icon className="size-5" />
                      </span>
                      <span className="line-clamp-2 break-all text-[11px] leading-4 text-muted-foreground group-hover:text-foreground">
                        {current.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                当前分类下没有匹配的图标
              </div>
            )}
          </div>

          <div className="border-t px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {filteredIcons.length > visibleIcons.length
                    ? `还有 ${filteredIcons.length - visibleIcons.length} 个图标未展示`
                    : '已展示全部匹配图标'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  关闭
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
