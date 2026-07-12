import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ArrowUp, AtSign, Loader2, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReferencePicker } from './picker'
import { ReferenceNode } from './reference-node'
import { ReferenceTag } from './reference-tag'
import { serializeReferenceDocument } from './serialize'
import type {
  ReferenceComposerProps,
  ReferenceContent,
  ReferenceOption,
} from './types'

export type {
  ReferenceComposerProps,
  ReferenceContent,
  ReferenceInput,
  ReferenceLoadRequest,
  ReferenceLoadResult,
  ReferenceOption,
  ReferencePart,
  ReferencePreview,
  ReferenceScope,
  ReferenceType,
} from './types'

export function ReferenceComposer({
  placeholder = '发消息',
  disabled = false,
  running = false,
  stopping = false,
  cancelable = false,
  className,
  loadReferences,
  onSubmit,
  onCancel,
}: ReferenceComposerProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitRef = useRef<() => void>(() => undefined)
  const rootRef = useRef<HTMLDivElement>(null)
  const pickerOpenRef = useRef(false)
  pickerOpenRef.current = pickerOpen
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        orderedList: false,
      }),
      Placeholder.configure({ placeholder }),
      ReferenceNode,
    ],
    editorProps: {
      attributes: {
        class: 'reference-composer-editor',
        'aria-label': placeholder,
      },
      handleTextInput(_view, _from, _to, text) {
        if (text !== '@') {
          return false
        }
        setPickerOpen(true)
        return true
      },
      handleKeyDown(_view, event) {
        if (
          event.key !== 'Enter' ||
          event.shiftKey ||
          event.isComposing ||
          pickerOpenRef.current
        ) {
          return false
        }
        event.preventDefault()
        submitRef.current()
        return true
      },
    },
  })

  useEffect(() => {
    editor?.setEditable(!disabled && !running && !submitting)
  }, [disabled, editor, running, submitting])

  useEffect(() => {
    if (!pickerOpen) {
      return
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [pickerOpen])

  const submit = useCallback(async () => {
    if (!editor || disabled || running || submitting) {
      return
    }
    const input = serializeReferenceDocument(editor.getJSON())
    if (!input.text && input.content.parts.length === 0) {
      return
    }
    const editorDocument = editor.getJSON()
    setSubmitting(true)
    try {
      const pending = onSubmit(input)
      editor.commands.clearContent(true)
      setPickerOpen(false)
      await pending
    } catch (error) {
      editor.commands.setContent(editorDocument)
      throw error
    } finally {
      setSubmitting(false)
    }
  }, [disabled, editor, onSubmit, running, submitting])
  submitRef.current = () => void submit()

  const insertReference = useCallback(
    (option: ReferenceOption) => {
      if (!editor || option.selectable === false) {
        return
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'reference',
          attrs: {
            refType: option.refType,
            refId: option.refId,
            label: option.label,
            previewText: option.preview?.text || option.description || '',
            previewKind: option.preview?.kind || '',
            previewUrl: option.preview?.url || '',
          },
        })
        .run()
      setPickerOpen(false)
    },
    [editor],
  )

  const composerDisabled = disabled || submitting
  return (
    <div ref={rootRef} className={cn('reference-composer', className)}>
      {pickerOpen ? (
        <ReferencePicker
          open={pickerOpen}
          loadReferences={loadReferences}
          onSelect={insertReference}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      <EditorContent
        editor={editor}
        className='reference-composer-content'
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Escape') {
            setPickerOpen(false)
          }
        }}
      />
      <div className='reference-composer-toolbar'>
        <button
          type='button'
          className='reference-composer-tool'
          title='引用消息或素材'
          disabled={composerDisabled || running}
          onClick={() => setPickerOpen((open) => !open)}
        >
          <AtSign />
        </button>
        {running ? (
          <button
            type='button'
            className='reference-composer-action'
            title={cancelable ? '停止生成' : '当前任务暂不可停止'}
            disabled={!cancelable || stopping}
            onClick={() => void onCancel?.()}
          >
            {stopping ? <Loader2 className='animate-spin' /> : <Square />}
          </button>
        ) : (
          <button
            type='button'
            className='reference-composer-action'
            title='发送'
            disabled={composerDisabled}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className='animate-spin' /> : <ArrowUp />}
          </button>
        )}
      </div>
      <style>{referenceComposerStyles}</style>
    </div>
  )
}

export function ReferenceContentView({
  content,
  fallback = '',
}: {
  content?: ReferenceContent
  fallback?: string
}) {
  if (!content?.parts?.length) {
    return <>{fallback}</>
  }
  return (
    <>
      {content.parts.map((part, index) =>
        part.type === 'reference' ? (
          <ReferenceTag
            key={`ref-${part.ref_type}-${part.ref_id}-${index}`}
            label={part.label}
            refType={part.ref_type}
            refId={part.ref_id}
            preview={part.preview}
          />
        ) : (
          <span key={`text-${index}`}>{part.text}</span>
        ),
      )}
    </>
  )
}

const referenceComposerStyles = `
.reference-composer { position: relative; min-height: 130px; border: 1px solid var(--border); border-radius: 24px; background: var(--background); box-shadow: 0 16px 44px rgba(15, 23, 42, .12); }
.reference-composer-content { min-height: 78px; padding: 18px 22px 8px; }
.reference-composer-editor { min-height: 52px; max-height: 180px; overflow-y: auto; white-space: pre-wrap; color: var(--foreground); font-size: 16px; line-height: 1.65; outline: none; }
.reference-composer-editor p { margin: 0; }
.reference-composer-editor p.is-editor-empty:first-child::before { float: left; height: 0; color: var(--muted-foreground); content: attr(data-placeholder); pointer-events: none; }
.reference-composer-editor span[data-reference], .reference-message-tag { display: inline-flex; max-width: 100%; align-items: center; margin: 0 2px; padding: 1px 7px; overflow: hidden; border: 1px solid color-mix(in oklab, var(--foreground) 13%, transparent); border-radius: 6px; background: color-mix(in oklab, var(--muted) 72%, transparent); color: var(--foreground); font-size: .9em; line-height: 1.55; vertical-align: baseline; text-overflow: ellipsis; white-space: nowrap; }
.reference-composer-editor .ProseMirror-selectednode { outline: 2px solid color-mix(in oklab, var(--foreground) 28%, transparent); outline-offset: 1px; }
.reference-composer-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 0 14px 12px; }
.reference-composer-tool, .reference-composer-action { display: inline-flex; width: 42px; height: 42px; align-items: center; justify-content: center; border: 0; border-radius: 50%; cursor: pointer; transition: background-color .16s ease, opacity .16s ease, transform .16s ease; }
.reference-composer-tool { background: transparent; color: var(--foreground); }
.reference-composer-tool:hover { background: var(--muted); }
.reference-composer-action { background: #111318; color: #fff; }
.reference-composer-action:hover:not(:disabled) { transform: translateY(-1px); background: #262a32; }
.reference-composer-tool:disabled, .reference-composer-action:disabled { cursor: default; opacity: .36; }
.reference-composer-tool svg, .reference-composer-action svg { width: 18px; height: 18px; }
.reference-composer-action svg[data-lucide='square'] { width: 13px; height: 13px; fill: currentColor; }
.reference-picker { position: absolute; bottom: calc(100% + 10px); left: 0; z-index: 80; width: min(720px, 100%); overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--popover); color: var(--popover-foreground); box-shadow: 0 18px 48px rgba(15, 23, 42, .16); }
.reference-picker-tabs { display: flex; gap: 4px; padding: 8px 10px 0; }
.reference-picker-tabs button { min-width: 0; flex: 1; border: 0; border-bottom: 2px solid transparent; background: transparent; padding: 8px 6px; color: var(--muted-foreground); font-size: 13px; cursor: pointer; }
.reference-picker-tabs button[data-active='true'] { border-bottom-color: var(--foreground); color: var(--foreground); font-weight: 600; }
.reference-picker-search { display: flex; height: 44px; align-items: center; gap: 9px; margin: 8px 12px; border-radius: 8px; background: var(--muted); padding: 0 12px; color: var(--muted-foreground); }
.reference-picker-search > svg, .reference-picker-back svg { width: 16px; height: 16px; }
.reference-picker-search input { min-width: 0; flex: 1; border: 0; background: transparent; color: var(--foreground); font-size: 14px; outline: none; }
.reference-picker-back { display: inline-flex; border: 0; background: transparent; padding: 0; color: inherit; cursor: pointer; }
.reference-picker-list { max-height: min(390px, 46vh); overflow-y: auto; padding: 0 8px 8px; }
.reference-picker-item { display: flex; width: 100%; min-height: 54px; align-items: center; gap: 10px; border: 0; border-radius: 8px; background: transparent; padding: 7px 9px; color: inherit; text-align: left; cursor: pointer; }
.reference-picker-item:hover:not(:disabled), .reference-picker-item:focus-visible, .reference-picker-item[data-active='true']:not(:disabled) { background: var(--muted); outline: none; }
.reference-picker-item:disabled { cursor: default; opacity: .48; }
.reference-picker-item-child { padding-left: 34px; }
.reference-picker-item-icon { display: inline-flex; width: 30px; height: 30px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 7px; background: color-mix(in oklab, var(--muted) 74%, transparent); color: var(--muted-foreground); }
.reference-picker-item-icon svg { width: 16px; height: 16px; }
.reference-picker-item-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.reference-picker-item-copy > span, .reference-picker-item-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-picker-item-copy > span { font-size: 14px; }
.reference-picker-item-copy small { color: var(--muted-foreground); font-size: 12px; }
.reference-picker-item img { width: 40px; height: 40px; flex: 0 0 auto; border-radius: 6px; object-fit: cover; }
.reference-picker-chevron { width: 16px; color: var(--muted-foreground); }
.reference-picker-state { display: flex; min-height: 108px; align-items: center; justify-content: center; color: var(--muted-foreground); font-size: 13px; }
.reference-picker-state svg, .reference-picker-more svg { width: 16px; height: 16px; }
.reference-picker-more { display: flex; width: 100%; align-items: center; justify-content: center; gap: 6px; border: 0; background: transparent; padding: 10px; color: var(--muted-foreground); font-size: 13px; cursor: pointer; }
@media (max-width: 767px) { .reference-composer { min-height: 112px; border-radius: 18px; } .reference-composer-content { min-height: 66px; padding: 14px 16px 6px; } .reference-composer-editor { min-height: 44px; max-height: 132px; } .reference-picker { position: fixed; right: 10px; bottom: calc(118px + env(safe-area-inset-bottom)); left: 10px; } }
`
