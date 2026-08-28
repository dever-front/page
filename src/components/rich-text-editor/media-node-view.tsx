import { useContext, useEffect, useRef, useState, type MouseEvent } from 'react'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { MessageSquareText } from 'lucide-react'
import { FirstFrameVideo } from '@/components/media/first-frame-video'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { RichTextFloatingLayerContext } from './floating-layer'

type EditorMediaNodeViewProps = ReactNodeViewProps & {
  kind: 'image' | 'video' | 'audio'
  label: string
  defaultMaxWidth?: string
}

const MIN_MEDIA_WIDTH_PERCENT = 20
const MAX_MEDIA_CAPTION_LENGTH = 1000
const CAPTION_BUTTON_WIDTH = 132
const CAPTION_BUTTON_HEIGHT = 36
const CAPTION_BUTTON_OFFSET = 12
const RESIZE_HANDLES = [
  {
    key: 'top-left',
    className: '-left-2 -top-2 cursor-nwse-resize',
    horizontal: -1,
    vertical: -1,
  },
  {
    key: 'top-right',
    className: '-right-2 -top-2 cursor-nesw-resize',
    horizontal: 1,
    vertical: -1,
  },
  {
    key: 'bottom-left',
    className: '-bottom-2 -left-2 cursor-nesw-resize',
    horizontal: -1,
    vertical: 1,
  },
  {
    key: 'bottom-right',
    className: '-bottom-2 -right-2 cursor-nwse-resize',
    horizontal: 1,
    vertical: 1,
  },
] as const

export function EditorMediaNodeView({
  node,
  selected,
  updateAttributes,
  editor,
  getPos,
  kind,
  label,
  defaultMaxWidth,
}: EditorMediaNodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const cleanupResizeRef = useRef<(() => void) | null>(null)
  const floatingLayerZIndex = useContext(RichTextFloatingLayerContext)
  const [isEditorFocused, setIsEditorFocused] = useState(editor.isFocused)
  const [captionDialogOpen, setCaptionDialogOpen] = useState(false)
  const [captionDraft, setCaptionDraft] = useState('')
  const [captionButtonPosition, setCaptionButtonPosition] = useState({
    left: CAPTION_BUTTON_OFFSET,
    top: CAPTION_BUTTON_OFFSET,
  })
  const normalizedMaxWidth = normalizeMediaSizeValue(node.attrs.maxWidth) || defaultMaxWidth || ''
  const align = normalizeMediaAlignValue(node.attrs.align)
  const src = String(node.attrs.src || '').trim()
  const alt = String(node.attrs.alt || '').trim()
  const title = String(node.attrs.title || '').trim()
  const caption = normalizeMediaCaption(node.attrs.caption)
  const showSelectionControls = selected && isEditorFocused

  useEffect(() => {
    return () => {
      cleanupResizeRef.current?.()
    }
  }, [])

  useEffect(() => {
    const handleFocus = () => {
      setIsEditorFocused(true)
    }

    const handleBlur = () => {
      setIsEditorFocused(false)
    }

    editor.on('focus', handleFocus)
    editor.on('blur', handleBlur)

    return () => {
      editor.off('focus', handleFocus)
      editor.off('blur', handleBlur)
    }
  }, [editor])

  const selectCurrentNode = () => {
    const position = typeof getPos === 'function' ? getPos() : null
    if (typeof position !== 'number') {
      return
    }

    editor.chain().focus().setNodeSelection(position).run()
  }

  const openCaptionDialog = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    selectCurrentNode()
    setCaptionDraft(caption)
    setCaptionDialogOpen(true)
  }

  const updateCaptionButtonPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    const eventTarget = event.target as HTMLElement | null
    if (eventTarget?.closest('[data-media-caption-action]')) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const maxLeft = Math.max(CAPTION_BUTTON_OFFSET, rect.width - CAPTION_BUTTON_WIDTH)
    const maxTop = Math.max(CAPTION_BUTTON_OFFSET, rect.height - CAPTION_BUTTON_HEIGHT)
    const nextLeft = clamp(
      event.clientX - rect.left + CAPTION_BUTTON_OFFSET,
      CAPTION_BUTTON_OFFSET,
      maxLeft
    )
    const nextTop = clamp(
      event.clientY - rect.top + CAPTION_BUTTON_OFFSET,
      CAPTION_BUTTON_OFFSET,
      maxTop
    )

    setCaptionButtonPosition((current) =>
      current.left === nextLeft && current.top === nextTop
        ? current
        : {
            left: nextLeft,
            top: nextTop,
          }
    )
  }

  const saveCaption = () => {
    updateAttributes({ caption: normalizeMediaCaption(captionDraft) })
    setCaptionDialogOpen(false)
    editor.chain().focus().run()
  }

  const clearCaption = () => {
    updateAttributes({ caption: '' })
    setCaptionDraft('')
    setCaptionDialogOpen(false)
    editor.chain().focus().run()
  }

  const handleResizeStart = (
    event: React.PointerEvent<HTMLButtonElement>,
    input: {
      horizontal: -1 | 1
      vertical: -1 | 1
    }
  ) => {
    event.preventDefault()
    event.stopPropagation()
    selectCurrentNode()

    const wrapperElement = wrapperRef.current
    const editorElement = wrapperElement?.closest('.tiptap-editor') as HTMLElement | null
    const containerWidth =
      editorElement?.getBoundingClientRect().width ||
      wrapperElement?.parentElement?.getBoundingClientRect().width ||
      0
    const startWidth = wrapperElement?.getBoundingClientRect().width || 0
    if (!wrapperElement || containerWidth <= 0 || startWidth <= 0) {
      return
    }

    cleanupResizeRef.current?.()

    const startX = event.clientX
    const minWidth = Math.max(containerWidth * (MIN_MEDIA_WIDTH_PERCENT / 100), 120)
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const horizontalDelta = (moveEvent.clientX - startX) * input.horizontal
      const verticalDelta = (moveEvent.clientY - event.clientY) * input.vertical
      const resizeDelta = (horizontalDelta + verticalDelta) / 2
      const nextWidth = clamp(startWidth + resizeDelta, minWidth, containerWidth)
      const percent = clamp(Math.round((nextWidth / containerWidth) * 100), MIN_MEDIA_WIDTH_PERCENT, 100)
      updateAttributes({ maxWidth: `${percent}%` })
    }

    const stopResize = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
      cleanupResizeRef.current = null
    }

    cleanupResizeRef.current = stopResize
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
  }

  return (
    <NodeViewWrapper
      as="div"
      className={cn('my-4 flex w-full', mediaAlignClassName(align))}
      contentEditable={false}
    >
      <div
        ref={wrapperRef}
        className={cn(
          'group/editor-media relative max-w-full cursor-grab active:cursor-grabbing',
          kind === 'audio' ? 'w-full max-w-sm' : 'inline-block',
          showSelectionControls && 'rounded-lg'
        )}
        data-drag-handle
        draggable="true"
        style={{ maxWidth: normalizedMaxWidth || undefined }}
        onClick={selectCurrentNode}
        onContextMenu={openCaptionDialog}
        onPointerMove={updateCaptionButtonPosition}
      >
        <button
          type="button"
          data-media-caption-action="true"
          draggable={false}
          className={cn(
            'absolute z-30 hidden h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium text-foreground shadow-md',
            'hover:bg-accent hover:text-accent-foreground group-hover/editor-media:flex',
            showSelectionControls && 'flex'
          )}
          style={{
            left: captionButtonPosition.left,
            top: captionButtonPosition.top,
          }}
          title={`右键添加或编辑${label}备注`}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            openCaptionDialog(event)
          }}
        >
          <MessageSquareText className="size-3.5" />
          右键添加备注
        </button>

        {showSelectionControls ? (
          <>
            {RESIZE_HANDLES.map((handle) => (
              <button
                key={handle.key}
                type="button"
                className={cn(
                  'absolute z-20 size-4 rounded-full border border-primary/40 bg-background shadow-sm',
                  handle.className
                )}
                title={`调整${label}大小`}
                onMouseDown={(resizeEvent) => {
                  resizeEvent.preventDefault()
                  resizeEvent.stopPropagation()
                }}
                onPointerDown={(resizeEvent) =>
                  handleResizeStart(resizeEvent, {
                    horizontal: handle.horizontal,
                    vertical: handle.vertical,
                  })
                }
              />
            ))}
            <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary/35 ring-offset-2 ring-offset-background" />
          </>
        ) : null}

        {kind === 'image' ? (
          <img
            src={src}
            alt={alt}
            title={title}
            draggable={false}
            className="block h-auto w-full max-w-full rounded-lg"
          />
        ) : null}

        {kind === 'video' ? (
          <FirstFrameVideo
            src={src}
            controls
            preload="metadata"
            playsInline
            draggable={false}
            className="block h-auto w-full max-w-full rounded-lg bg-black/90"
          />
        ) : null}

        {kind === 'audio' ? (
          <audio
            src={src}
            controls
            preload="none"
            className="block w-full"
          />
        ) : null}

        {caption ? (
          <div className="mt-2 whitespace-pre-line break-words px-1 text-center text-xs leading-5 text-muted-foreground">
            {caption}
          </div>
        ) : null}
      </div>
      <Dialog open={captionDialogOpen} onOpenChange={setCaptionDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          layerZIndex={floatingLayerZIndex}
        >
          <DialogHeader>
            <DialogTitle>{label}备注</DialogTitle>
            <DialogDescription>
              备注会显示在{label}下方，只能通过媒体上的备注按钮或右键再次修改。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={captionDraft}
            maxLength={MAX_MEDIA_CAPTION_LENGTH}
            rows={4}
            placeholder={`输入${label}备注描述`}
            onChange={(event) => setCaptionDraft(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
          <div className="text-right text-xs text-muted-foreground">
            {captionDraft.length}/{MAX_MEDIA_CAPTION_LENGTH}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCaptionDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!caption && !captionDraft.trim()}
              onClick={clearCaption}
            >
              清空
            </Button>
            <Button type="button" onClick={saveCaption}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NodeViewWrapper>
  )
}

export function EditorExternalMediaNodeView({
  node,
  selected,
  editor,
  getPos,
}: ReactNodeViewProps) {
  const kind = normalizeExternalMediaKind(node.attrs.kind)
  const src = String(node.attrs.src || '').trim()
  const title = String(node.attrs.title || '').trim() || externalMediaLabel(kind)
  const cover = String(node.attrs.cover || '').trim()
  const align = normalizeMediaAlignValue(node.attrs.align)
  const normalizedMaxWidth = normalizeMediaSizeValue(node.attrs.maxWidth) || '520px'

  const selectCurrentNode = () => {
    const position = typeof getPos === 'function' ? getPos() : null
    if (typeof position !== 'number') {
      return
    }
    editor.chain().focus().setNodeSelection(position).run()
  }

  return (
    <NodeViewWrapper
      as="div"
      className={cn('my-4 flex w-full', mediaAlignClassName(align))}
      contentEditable={false}
    >
      <a
        href={src || undefined}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'group/editor-media-embed flex w-full max-w-full items-center gap-3 rounded-lg border bg-muted/25 p-3 text-left no-underline transition hover:bg-muted/40',
          selected && 'ring-2 ring-primary/35 ring-offset-2 ring-offset-background'
        )}
        style={{ maxWidth: normalizedMaxWidth }}
        data-drag-handle
        draggable="true"
        onClick={(event) => {
          event.preventDefault()
          selectCurrentNode()
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-14 w-20 shrink-0 rounded-md object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background text-xs font-medium text-muted-foreground">
            {kind === 'audio' ? '音频' : '视频'}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{src}</span>
        </span>
      </a>
    </NodeViewWrapper>
  )
}

function normalizeMediaSizeValue(value: unknown) {
  const text = String(value || '').trim()
  if (/^\d+(\.\d+)?%$/.test(text)) {
    return text
  }
  if (/^\d+(\.\d+)?px$/.test(text)) {
    return text
  }
  return ''
}

function normalizeMediaAlignValue(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  return text === 'center' || text === 'right' ? text : 'left'
}

function mediaAlignClassName(align: string) {
  if (align === 'center') {
    return 'justify-center'
  }
  if (align === 'right') {
    return 'justify-end'
  }
  return 'justify-start'
}

function normalizeExternalMediaKind(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'audio' ? 'audio' : 'video'
}

function externalMediaLabel(kind: string) {
  return kind === 'audio' ? '查看音频' : '查看视频'
}

function normalizeMediaCaption(value: unknown) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_MEDIA_CAPTION_LENGTH)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
