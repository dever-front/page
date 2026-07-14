import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  File,
  Image,
  Loader2,
  MessageSquare,
  Play,
  Search,
  UserRound,
  Video,
  Volume2,
} from 'lucide-react'
import { ReferencePreviewPopover } from './reference-preview-popover'
import { groupReferenceRows, type ReferenceTurn } from './turns'
import type {
  ReferenceLoadRequest,
  ReferenceOption,
  ReferencePreviewLoader,
  ReferenceScope,
} from './types'

const scopes: Array<{ id: ReferenceScope; label: string }> = [
  { id: 'current', label: '当前会话' },
  { id: 'history', label: '历史会话' },
]

export function ReferencePicker({
  open,
  loadReferences,
  loadPreview,
  onSelect,
  onClose,
}: {
  open: boolean
  loadReferences: (request: ReferenceLoadRequest) => Promise<{
    items: ReferenceOption[]
    nextCursor?: string
  }>
  loadPreview: ReferencePreviewLoader
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
  const listRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    if (!open) {
      return
    }
    const token = ++requestToken.current
    inputRef.current?.focus()
    setLoading(true)
    loadingMoreRef.current = false
    setLoadingMore(false)
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

  function activateOption(item: ReferenceOption) {
    const index = items.findIndex((current) => current.key === item.key)
    if (index >= 0) {
      setActiveIndex(index)
    }
  }

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) {
      return
    }
    const token = requestToken.current
    const cursor = nextCursor
    loadingMoreRef.current = true
    setLoadingMore(true)
    setError('')
    try {
      const result = await loadReferences({
        scope,
        query: query.trim(),
        cursor,
        parent,
      })
      if (requestToken.current !== token) {
        return
      }
      setItems((current) => mergeOptions(current, result.items))
      setNextCursor(result.nextCursor)
    } catch (currentError: unknown) {
      if (requestToken.current === token) {
        setError(errorText(currentError))
      }
    } finally {
      if (requestToken.current === token) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }, [loadReferences, nextCursor, parent, query, scope])

  useEffect(() => {
    const root = listRef.current
    const target = loadMoreRef.current
    if (!open || loading || error || !nextCursor || !root || !target) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore()
        }
      },
      { root, rootMargin: '0px 0px 80px', threshold: 0.01 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [error, loadMore, loading, nextCursor, open])

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
          placeholder={parent ? parent.label : '搜索消息或会话'}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onClose()
              return
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((current) =>
                nextSelectableIndex(
                  items,
                  current,
                  event.key === 'ArrowDown' ? 1 : -1
                )
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
      <div
        ref={listRef}
        className='reference-picker-list'
        onWheelCapture={(event) => event.stopPropagation()}
      >
        {loading ? (
          <div className='reference-picker-state'>
            <Loader2 className='animate-spin' />
          </div>
        ) : error ? (
          <div className='reference-picker-state text-destructive'>{error}</div>
        ) : items.length === 0 ? (
          <div className='reference-picker-state'>没有可引用的内容</div>
        ) : (
          groupReferenceRows(items).map((row) =>
            row.type === 'turn' ? (
              <ReferencePickerTurn
                key={row.key}
                turn={row.turn}
                activeKey={items[activeIndex]?.key}
                loadPreview={loadPreview}
                onActivate={activateOption}
                onSelect={chooseOption}
              />
            ) : (
              <ReferencePickerItem
                key={row.key}
                item={row.item}
                active={items[activeIndex]?.key === row.item.key}
                loadPreview={loadPreview}
                onActivate={() => activateOption(row.item)}
                onSelect={chooseOption}
              />
            )
          )
        )}
        {nextCursor && !loading ? (
          <div
            ref={loadMoreRef}
            className='reference-picker-more'
            role='status'
          >
            {loadingMore ? <Loader2 className='animate-spin' /> : null}
            <span className='sr-only'>
              {loadingMore ? '正在加载更多' : '继续滚动加载更多'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ReferencePickerItem({
  item,
  active,
  loadPreview,
  onActivate,
  onSelect,
}: {
  item: ReferenceOption
  active: boolean
  loadPreview: ReferencePreviewLoader
  onActivate: () => void
  onSelect: (option: ReferenceOption) => void
}) {
  return (
    <div className='reference-picker-entry'>
      <ReferenceOptionButton
        item={item}
        active={active}
        loadPreview={loadPreview}
        onActivate={onActivate}
        onSelect={onSelect}
      />
      {item.materials?.length ? (
        <ReferenceMaterialGrid
          materials={item.materials}
          loadPreview={loadPreview}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  )
}

function ReferencePickerTurn({
  turn,
  activeKey,
  loadPreview,
  onActivate,
  onSelect,
}: {
  turn: ReferenceTurn
  activeKey?: string
  loadPreview: ReferencePreviewLoader
  onActivate: (option: ReferenceOption) => void
  onSelect: (option: ReferenceOption) => void
}) {
  const assistant = turn.assistant
  const user = turn.user
  return (
    <div className='reference-picker-turn'>
      <div className='reference-picker-turn-messages'>
        {assistant ? (
          <ReferenceOptionButton
            item={assistant}
            active={activeKey === assistant.key}
            variant='turn'
            loadPreview={loadPreview}
            onActivate={() => onActivate(assistant)}
            onSelect={onSelect}
          />
        ) : (
          <span className='reference-picker-turn-empty' aria-hidden='true' />
        )}
        {user ? (
          <ReferenceOptionButton
            item={user}
            active={activeKey === user.key}
            variant='turn'
            loadPreview={loadPreview}
            onActivate={() => onActivate(user)}
            onSelect={onSelect}
          />
        ) : (
          <span className='reference-picker-turn-empty' aria-hidden='true' />
        )}
      </div>
      {turn.materials.length ? (
        <ReferenceMaterialGrid
          materials={turn.materials}
          loadPreview={loadPreview}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  )
}

function ReferenceOptionButton({
  item,
  active,
  variant = 'list',
  loadPreview,
  onActivate,
  onSelect,
}: {
  item: ReferenceOption
  active: boolean
  variant?: 'list' | 'turn'
  loadPreview: ReferencePreviewLoader
  onActivate: () => void
  onSelect: (option: ReferenceOption) => void
}) {
  const disabled = item.selectable === false && !item.hasChildren
  const triggerClassName =
    variant === 'turn'
      ? `reference-picker-turn-preview reference-picker-turn-preview-${item.messageRole || 'message'}`
      : 'reference-picker-item-preview'
  const buttonClassName =
    variant === 'turn'
      ? 'reference-picker-item reference-picker-turn-message'
      : 'reference-picker-item'

  return (
    <ReferencePreviewPopover
      label={item.label}
      refType={item.refType}
      refId={item.refId}
      hint={item.preview}
      loadPreview={disabled ? undefined : loadPreview}
      openDelay={180}
      hoverOnly
      side='right'
      align='start'
      triggerClassName={triggerClassName}
    >
      <button
        type='button'
        disabled={disabled}
        data-active={active}
        data-role={item.messageRole}
        className={buttonClassName}
        onMouseEnter={onActivate}
        onClick={() => onSelect(item)}
      >
        <span className='reference-picker-item-icon'>
          <OptionIcon option={item} />
        </span>
        <span className='reference-picker-item-copy'>
          <span>{item.label}</span>
          {item.description ? <small>{item.description}</small> : null}
        </span>
        {item.hasChildren ? (
          <ChevronRight className='reference-picker-chevron' />
        ) : null}
      </button>
    </ReferencePreviewPopover>
  )
}

function ReferenceMaterialGrid({
  materials,
  loadPreview,
  onSelect,
}: {
  materials: ReferenceOption[]
  loadPreview: ReferencePreviewLoader
  onSelect: (option: ReferenceOption) => void
}) {
  return (
    <div className='reference-picker-materials'>
      {materials.map((material) => (
        <ReferencePreviewPopover
          key={material.key}
          label={material.label}
          refType={material.refType}
          refId={material.refId}
          hint={material.preview}
          loadPreview={loadPreview}
          openDelay={180}
          hoverOnly
          side='right'
          align='start'
          triggerClassName='reference-picker-material-preview'
        >
          <button
            type='button'
            className='reference-picker-material'
            aria-label={`引用${material.label}`}
            onClick={() => onSelect(material)}
          >
            <span className='reference-picker-material-thumb'>
              <MaterialPreview option={material} />
            </span>
            <span className='reference-picker-material-label'>
              {material.label}
            </span>
          </button>
        </ReferencePreviewPopover>
      ))}
    </div>
  )
}

function MaterialPreview({ option }: { option: ReferenceOption }) {
  const kind = option.preview?.kind
  const previewUrl = option.preview?.url
  const sourceUrl = option.preview?.sourceUrl || previewUrl
  if (kind === 'image' && previewUrl) {
    return <LazyThumbnail src={previewUrl} alt={option.label} />
  }
  if (kind === 'video') {
    const hasThumbnail = Boolean(previewUrl && previewUrl !== sourceUrl)
    return (
      <>
        {hasThumbnail && previewUrl ? (
          <LazyThumbnail src={previewUrl} alt={option.label} />
        ) : sourceUrl ? (
          <video src={sourceUrl} muted playsInline preload='metadata' />
        ) : (
          <Video />
        )}
        <span className='reference-picker-material-play' aria-hidden='true'>
          <Play />
        </span>
      </>
    )
  }
  if (kind === 'audio') return <Volume2 />
  return <File />
}

function OptionIcon({ option }: { option: ReferenceOption }) {
  if (option.preview?.kind === 'image' && option.preview.url) {
    return <LazyThumbnail src={option.preview.url} alt='' />
  }
  if (option.preview?.kind === 'image') return <Image />
  if (option.preview?.kind === 'video') return <Video />
  if (option.preview?.kind === 'audio') return <Volume2 />
  if (option.messageRole === 'assistant') return <Bot />
  if (option.messageRole === 'user') return <UserRound />
  if (option.refType === 'message' || option.refType === 'session') {
    return <MessageSquare />
  }
  return <File />
}

function LazyThumbnail({ src, alt }: { src: string; alt: string }) {
  const [visible, setVisible] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const image = imageRef.current
    if (!image || visible) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return
        }
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '80px' }
    )
    observer.observe(image)
    return () => observer.disconnect()
  }, [visible])

  return (
    <img
      ref={imageRef}
      src={visible ? src : undefined}
      alt={alt}
      loading='lazy'
      decoding='async'
    />
  )
}

function mergeOptions(current: ReferenceOption[], next: ReferenceOption[]) {
  const keys = new Set(current.map((item) => item.key))
  return [...current, ...next.filter((item) => !keys.has(item.key))]
}

function firstSelectableIndex(items: ReferenceOption[]) {
  const index = items.findIndex(
    (item) => item.selectable !== false || item.hasChildren
  )
  return Math.max(0, index)
}

function nextSelectableIndex(
  items: ReferenceOption[],
  current: number,
  direction: 1 | -1
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
  return error instanceof Error && error.message
    ? error.message
    : '加载引用失败'
}
