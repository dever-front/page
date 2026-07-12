import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  File,
  Image,
  Loader2,
  MessageSquare,
  Search,
  Video,
  Volume2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  ReferenceLoadRequest,
  ReferenceOption,
  ReferenceScope,
} from './types'

const scopes: Array<{ id: ReferenceScope; label: string }> = [
  { id: 'current', label: '当前会话' },
  { id: 'history', label: '历史会话' },
  { id: 'resource', label: '资源中心' },
]

export function ReferencePicker({
  open,
  loadReferences,
  onSelect,
  onClose,
}: {
  open: boolean
  loadReferences: (request: ReferenceLoadRequest) => Promise<{
    items: ReferenceOption[]
    nextCursor?: string
  }>
  onSelect: (option: ReferenceOption) => void
  onClose: () => void
}) {
  const [scope, setScope] = useState<ReferenceScope>('current')
  const [parent, setParent] = useState<ReferenceOption>()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ReferenceOption[]>([])
  const [nextCursor, setNextCursor] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const requestToken = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const token = ++requestToken.current
    inputRef.current?.focus()
    setLoading(true)
    setError('')
    const timer = window.setTimeout(() => {
      void loadReferences({ scope, query: query.trim(), parent })
        .then((result) => {
          if (requestToken.current !== token) {
            return
          }
          setItems(result.items)
          setNextCursor(result.nextCursor)
        })
        .catch((currentError: unknown) => {
          if (requestToken.current === token) {
            setItems([])
            setNextCursor(undefined)
            setError(errorText(currentError))
          }
        })
        .finally(() => {
          if (requestToken.current === token) {
            setLoading(false)
          }
        })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [loadReferences, open, parent, query, scope])

  useEffect(() => {
    if (!open) {
      setParent(undefined)
      setQuery('')
    }
  }, [open])

  useEffect(() => setActiveIndex(firstSelectableIndex(items)), [items])

  function chooseOption(item: ReferenceOption | undefined) {
    if (!item) {
      return
    }
    if (item.hasChildren && item.selectable === false) {
      setParent(item)
      setQuery('')
      return
    }
    if (item.selectable !== false) {
      onSelect(item)
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) {
      return
    }
    setLoadingMore(true)
    setError('')
    try {
      const result = await loadReferences({
        scope,
        query: query.trim(),
        cursor: nextCursor,
        parent,
      })
      setItems((current) => mergeOptions(current, result.items))
      setNextCursor(result.nextCursor)
    } catch (currentError: unknown) {
      setError(errorText(currentError))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className='reference-picker' role='dialog' aria-label='选择引用内容'>
      <div className='reference-picker-tabs'>
        {scopes.map((item) => (
          <button
            key={item.id}
            type='button'
            data-active={scope === item.id}
            onClick={() => {
              setScope(item.id)
              setParent(undefined)
              setQuery('')
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className='reference-picker-search'>
        {parent ? (
          <button
            type='button'
            className='reference-picker-back'
            title='返回会话列表'
            onClick={() => setParent(undefined)}
          >
            <ArrowLeft />
          </button>
        ) : (
          <Search />
        )}
        <input
          ref={inputRef}
          value={query}
          placeholder={parent ? parent.label : '搜索消息、素材或会话'}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onClose()
              return
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((current) =>
                nextSelectableIndex(items, current, event.key === 'ArrowDown' ? 1 : -1),
              )
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              chooseOption(items[activeIndex])
            }
          }}
        />
      </div>
      <div className='reference-picker-list'>
        {loading ? (
          <div className='reference-picker-state'>
            <Loader2 className='animate-spin' />
          </div>
        ) : error ? (
          <div className='reference-picker-state text-destructive'>{error}</div>
        ) : items.length === 0 ? (
          <div className='reference-picker-state'>没有可引用的内容</div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.key}
              type='button'
              disabled={item.selectable === false && !item.hasChildren}
              data-active={activeIndex === index}
              className={cn(
                'reference-picker-item',
                item.parentKey && 'reference-picker-item-child',
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => chooseOption(item)}
            >
              <span className='reference-picker-item-icon'>
                <OptionIcon option={item} />
              </span>
              <span className='reference-picker-item-copy'>
                <span>{item.label}</span>
                {item.description ? <small>{item.description}</small> : null}
              </span>
              {item.preview?.url ? (
                <img src={item.preview.url} alt='' loading='lazy' />
              ) : item.hasChildren ? (
                <ChevronRight className='reference-picker-chevron' />
              ) : null}
            </button>
          ))
        )}
        {nextCursor && !loading ? (
          <button
            type='button'
            className='reference-picker-more'
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? <Loader2 className='animate-spin' /> : null}
            加载更多
          </button>
        ) : null}
      </div>
    </div>
  )
}

function OptionIcon({ option }: { option: ReferenceOption }) {
  if (option.preview?.kind === 'image') return <Image />
  if (option.preview?.kind === 'video') return <Video />
  if (option.preview?.kind === 'audio') return <Volume2 />
  if (option.refType === 'message' || option.refType === 'session') {
    return <MessageSquare />
  }
  return <File />
}

function mergeOptions(
  current: ReferenceOption[],
  next: ReferenceOption[],
) {
  const keys = new Set(current.map((item) => item.key))
  return [...current, ...next.filter((item) => !keys.has(item.key))]
}

function firstSelectableIndex(items: ReferenceOption[]) {
  const index = items.findIndex(
    (item) => item.selectable !== false || item.hasChildren,
  )
  return Math.max(0, index)
}

function nextSelectableIndex(
  items: ReferenceOption[],
  current: number,
  direction: 1 | -1,
) {
  if (items.length === 0) {
    return 0
  }
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (current + direction * offset + items.length) % items.length
    const item = items[index]
    if (item && (item.selectable !== false || item.hasChildren)) {
      return index
    }
  }
  return current
}

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : '加载引用失败'
}
