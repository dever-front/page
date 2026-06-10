import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { cn } from '@/lib/utils'

type EditorMediaNodeViewProps = ReactNodeViewProps & {
  kind: 'image' | 'video' | 'audio'
  label: string
  defaultMaxWidth?: string
}

const MIN_MEDIA_WIDTH_PERCENT = 20
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
  const [isEditorFocused, setIsEditorFocused] = useState(editor.isFocused)
  const normalizedMaxWidth = normalizeMediaSizeValue(node.attrs.maxWidth) || defaultMaxWidth || ''
  const src = String(node.attrs.src || '').trim()
  const alt = String(node.attrs.alt || '').trim()
  const title = String(node.attrs.title || '').trim()
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
      className="my-4 flex w-full justify-start"
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
      >
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
          <video
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
      </div>
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
