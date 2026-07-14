import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ArrowUp, AtSign, Loader2, Square } from 'lucide-react'
import type { UploadFileItem } from '@/lib/upload'
import { cn } from '@/lib/utils'
import {
  buildDefaultParamValues,
  buildRequestInput,
  isFileParam,
  normalizePowerParams,
  paramFilesRequestValue,
  PowerParamPopover,
  validateMainParams,
  type ParamFileMap,
  type ParamValueMap,
  type PowerParam,
} from '@/components/agent/stream-request-params'
import { ReferenceAttachmentMenu } from './attachment-menu'
import { ReferencePicker } from './picker'
import { ReferenceNode } from './reference-node'
import { ReferenceTag } from './reference-tag'
import { serializeReferenceDocument } from './serialize'
import type {
  ReferenceComposerProps,
  ReferenceContent,
  ReferenceOption,
  ReferencePreviewLoader,
} from './types'

const EMPTY_PARAM_FILES: UploadFileItem[] = []

export type {
  ReferenceComposerParam,
  ReferenceComposerProps,
  ReferenceContent,
  ReferenceInput,
  ReferenceLoadRequest,
  ReferenceLoadResult,
  ReferenceOption,
  ReferencePart,
  ReferencePreview,
  ReferencePreviewHint,
  ReferencePreviewLoader,
  ReferencePreviewMedia,
  ReferencePreviewRequest,
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
  layerZIndex,
  parameters = [],
  loadReferences,
  loadPreview,
  onSubmit,
  onCancel,
}: ReferenceComposerProps) {
  const normalizedParams = useMemo(
    () => normalizePowerParams(parameters),
    [parameters]
  )
  const fileParams = useMemo(
    () => normalizedParams.filter(isFileParam),
    [normalizedParams]
  )
  const toolbarParams = useMemo(
    () =>
      normalizedParams.filter((param) => {
        const type = String(param.type || '')
          .trim()
          .toLowerCase()
        return (
          !isFileParam(param) && type !== 'hidden' && type !== 'description'
        )
      }),
    [normalizedParams]
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [paramValues, setParamValues] = useState<ParamValueMap>({})
  const [attachmentFiles, setAttachmentFiles] = useState<ParamFileMap>({})
  const [attachmentCounts, setAttachmentCounts] = useState<
    Record<string, number>
  >({})
  const submitRef = useRef<() => void>(() => undefined)
  const rootRef = useRef<HTMLDivElement>(null)
  const pickerOpenRef = useRef(false)
  const loadPreviewRef = useRef(loadPreview)
  pickerOpenRef.current = pickerOpen
  loadPreviewRef.current = loadPreview
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
      ReferenceNode.configure({
        loadPreview: (request) => loadPreviewRef.current(request),
      }),
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
    onUpdate({ editor: currentEditor }) {
      setAttachmentCounts(referenceUsageCounts(currentEditor.getJSON()))
    },
  })

  useEffect(() => {
    setParamValues(buildDefaultParamValues(normalizedParams))
    setAttachmentFiles({})
    setAttachmentCounts({})
    setMessage('')
  }, [normalizedParams])

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
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [pickerOpen])

  const submit = useCallback(async () => {
    if (!editor || disabled || running || submitting) {
      return
    }
    const input = serializeReferenceDocument(editor.getJSON())
    if (!input.text && input.content.parts.length === 0) {
      return
    }
    const activeFiles = activeParamFiles(input.content, attachmentFiles)
    const requestValues: ParamValueMap = { ...paramValues }
    for (const param of fileParams) {
      const key = String(param.key || '').trim()
      if (key) {
        requestValues[key] = paramFilesRequestValue(
          param,
          activeFiles[key] || []
        )
      }
    }
    const validationMessage = validateMainParams(
      normalizedParams,
      requestValues
    )
    if (validationMessage) {
      setMessage(validationMessage)
      return
    }
    const params = buildRequestInput(normalizedParams, requestValues)
    input.params = params
    input.content.params = params
    const editorDocument = editor.getJSON()
    const previousValues = paramValues
    const previousFiles = attachmentFiles
    setSubmitting(true)
    setMessage('')
    try {
      const pending = onSubmit(input)
      editor.commands.clearContent(true)
      setPickerOpen(false)
      setParamValues(buildDefaultParamValues(normalizedParams))
      setAttachmentFiles({})
      setAttachmentCounts({})
      await pending
    } catch (error) {
      editor.commands.setContent(editorDocument)
      setParamValues(previousValues)
      setAttachmentFiles(previousFiles)
      setAttachmentCounts(referenceUsageCounts(editorDocument))
      setMessage(error instanceof Error ? error.message : '发送失败。')
    } finally {
      setSubmitting(false)
    }
  }, [
    attachmentFiles,
    disabled,
    editor,
    fileParams,
    normalizedParams,
    onSubmit,
    paramValues,
    running,
    submitting,
  ])
  submitRef.current = () => void submit()

  const insertReference = useCallback(
    (option: ReferenceOption) => {
      if (!editor || option.selectable === false) {
        return
      }
      editor
        .chain()
        .focus()
        .insertContent(referenceInsertionContent([option]))
        .run()
      setPickerOpen(false)
    },
    [editor]
  )

  const insertAttachments = useCallback(
    (
      param: PowerParam,
      files: UploadFileItem[],
      options: ReferenceOption[]
    ) => {
      const key = String(param.key || '').trim()
      if (!key || !editor) {
        return
      }
      const existingIDs = referenceIDsForUsage(editor.getJSON(), key)
      const nextOptions = options.filter((option) => {
        const id = String(option.refId || '')
        if (!id || existingIDs.has(id)) {
          return false
        }
        existingIDs.add(id)
        return true
      })
      if (nextOptions.length === 0) {
        setMessage(`参数“${param.name}”中已添加所选资源。`)
        return
      }
      const nextIDs = new Set(nextOptions.map((option) => String(option.refId)))
      setAttachmentFiles((current) => ({
        ...current,
        [key]: appendUniqueFiles(
          current[key] || [],
          files.filter((file) => nextIDs.has(String(file.id)))
        ),
      }))
      const content = referenceInsertionContent(nextOptions, key)
      if (content.length > 0) {
        editor.chain().focus().insertContent(content).run()
      }
      setMessage('')
    },
    [editor]
  )

  const composerDisabled = disabled || submitting
  return (
    <div ref={rootRef} className={cn('reference-composer', className)}>
      {pickerOpen ? (
        <ReferencePicker
          open={pickerOpen}
          loadReferences={loadReferences}
          loadPreview={loadPreview}
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
      {message ? (
        <div className='reference-composer-message'>{message}</div>
      ) : null}
      <div className='reference-composer-toolbar'>
        <div className='reference-composer-tools'>
          <ReferenceAttachmentMenu
            params={fileParams}
            counts={attachmentCounts}
            layerZIndex={layerZIndex}
            disabled={composerDisabled || running}
            onInsert={insertAttachments}
            onMessage={setMessage}
          />
          <button
            type='button'
            className='reference-composer-tool'
            title='引用消息或素材'
            disabled={composerDisabled || running}
            onClick={() => setPickerOpen((open) => !open)}
          >
            <AtSign />
          </button>
          {toolbarParams.map((param) => {
            const key = String(param.key || '').trim()
            return (
              <PowerParamPopover
                key={`${param.id}:${key}`}
                param={param}
                value={paramValues[key]}
                files={EMPTY_PARAM_FILES}
                disabled={composerDisabled || running}
                triggerClassName='w-auto min-w-0 max-w-[12rem] shrink-0'
                onChange={(value) => {
                  setParamValues((current) => ({ ...current, [key]: value }))
                  setMessage('')
                }}
                onFilesChange={() => undefined}
              />
            )
          })}
        </div>
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

function appendUniqueFiles(
  current: UploadFileItem[],
  incoming: UploadFileItem[]
) {
  const result = [...current]
  const ids = new Set(current.map((file) => String(file.id)))
  for (const file of incoming) {
    const id = String(file.id || '')
    if (!id || ids.has(id)) {
      continue
    }
    ids.add(id)
    result.push(file)
  }
  return result
}

function referenceInsertionContent(
  options: ReferenceOption[],
  defaultUsage = ''
) {
  if (options.length === 0) {
    return []
  }
  const content: import('@tiptap/core').JSONContent[] = [textNode(' ')]
  options.forEach((option, index) => {
    if (index > 0) {
      content.push(textNode(' '))
    }
    content.push({
      type: 'reference',
      attrs: {
        refType: option.refType,
        refId: option.refId,
        label: option.label,
        usage: option.usage || defaultUsage,
        previewText: option.preview?.text || option.description || '',
        previewKind: option.preview?.kind || '',
        previewUrl: option.preview?.url || '',
      },
    })
  })
  content.push(textNode(' '))
  return content
}

function textNode(text: string): import('@tiptap/core').JSONContent {
  return { type: 'text', text }
}

function activeParamFiles(content: ReferenceContent, files: ParamFileMap) {
  const active = new Map<string, Set<string>>()
  for (const part of content.parts) {
    if (part.type !== 'reference' || !part.usage) {
      continue
    }
    const ids = active.get(part.usage) || new Set<string>()
    ids.add(String(part.ref_id))
    active.set(part.usage, ids)
  }
  const result: ParamFileMap = {}
  for (const [key, values] of Object.entries(files)) {
    const ids = active.get(key)
    result[key] = ids ? values.filter((file) => ids.has(String(file.id))) : []
  }
  return result
}

function referenceUsageCounts(document: import('@tiptap/core').JSONContent) {
  const result: Record<string, number> = {}
  walkReferenceNodes(document, (usage) => {
    result[usage] = (result[usage] || 0) + 1
  })
  return result
}

function referenceIDsForUsage(
  document: import('@tiptap/core').JSONContent,
  targetUsage: string
) {
  const result = new Set<string>()
  walkReferenceNodes(document, (usage, refID) => {
    if (usage === targetUsage && refID) {
      result.add(refID)
    }
  })
  return result
}

function walkReferenceNodes(
  node: import('@tiptap/core').JSONContent,
  visit: (usage: string, refID: string) => void
) {
  if (node.type === 'reference') {
    const usage = String(node.attrs?.usage || '').trim()
    if (usage) {
      visit(usage, String(node.attrs?.refId || ''))
    }
  }
  for (const child of node.content || []) {
    walkReferenceNodes(child, visit)
  }
}

export function ReferenceContentView({
  content,
  fallback = '',
  loadPreview,
}: {
  content?: ReferenceContent
  fallback?: string
  loadPreview?: ReferencePreviewLoader
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
            loadPreview={loadPreview}
          />
        ) : (
          <span key={`text-${index}`}>{part.text}</span>
        )
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
.reference-composer-editor .reference-node-view { display: inline-flex; margin: 3px 4px; vertical-align: middle; }
.reference-composer-editor .reference-node-view.ProseMirror-selectednode { outline: none; }
.reference-composer-toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; padding: 0 14px 12px; }
.reference-composer-tools { display: flex; min-width: 0; flex: 1; flex-wrap: wrap; align-items: center; gap: 6px; }
.reference-composer-message { padding: 0 22px 6px; color: var(--destructive); font-size: 13px; line-height: 1.5; }
.reference-composer-tool, .reference-composer-action { display: inline-flex; width: 42px; height: 42px; align-items: center; justify-content: center; border: 0; border-radius: 50%; cursor: pointer; transition: background-color .16s ease, opacity .16s ease, transform .16s ease; }
.reference-composer-tool { background: transparent; color: var(--foreground); }
.reference-composer-tool:hover { background: var(--muted); }
.reference-composer-action { flex: 0 0 42px; background: #111318; color: #fff; }
.reference-composer-action:hover:not(:disabled) { transform: translateY(-1px); background: #262a32; }
.reference-composer-tool:disabled, .reference-composer-action:disabled { cursor: default; opacity: .36; }
.reference-composer-tool svg, .reference-composer-action svg { width: 18px; height: 18px; }
.reference-composer-action svg[data-lucide='square'] { width: 13px; height: 13px; fill: currentColor; }
.reference-picker { position: absolute; bottom: calc(100% + 10px); left: 0; z-index: 80; width: min(560px, 100%); overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--popover); color: var(--popover-foreground); box-shadow: 0 18px 48px rgba(15, 23, 42, .16); }
.reference-picker-tabs { display: flex; gap: 4px; padding: 8px 10px 0; }
.reference-picker-tabs button { min-width: 0; flex: 1; border: 0; border-bottom: 2px solid transparent; background: transparent; padding: 8px 6px; color: var(--muted-foreground); font-size: 13px; cursor: pointer; }
.reference-picker-tabs button[data-active='true'] { border-bottom-color: var(--foreground); color: var(--foreground); font-weight: 600; }
.reference-picker-search { display: flex; height: 44px; align-items: center; gap: 9px; margin: 8px 12px; border-radius: 8px; background: var(--muted); padding: 0 12px; color: var(--muted-foreground); }
.reference-picker-search > svg, .reference-picker-back svg { width: 16px; height: 16px; }
.reference-picker-search input { min-width: 0; flex: 1; border: 0; background: transparent; color: var(--foreground); font-size: 14px; outline: none; }
.reference-picker-back { display: inline-flex; border: 0; background: transparent; padding: 0; color: inherit; cursor: pointer; }
.reference-picker-list { max-height: min(390px, 46vh); overflow-y: auto; padding: 0 8px 8px; }
.reference-picker-entry { width: 100%; }
.reference-picker-item { display: flex; width: 100%; min-height: 54px; align-items: center; gap: 10px; border: 0; border-radius: 8px; background: transparent; padding: 7px 9px; color: inherit; text-align: left; cursor: pointer; }
.reference-picker-item:hover:not(:disabled), .reference-picker-item:focus-visible, .reference-picker-item[data-active='true']:not(:disabled) { background: var(--muted); outline: none; }
.reference-picker-item:disabled { cursor: default; opacity: .48; }
.reference-picker-item-preview { display: block; width: 100%; border-radius: 8px; }
.reference-picker-item-icon { display: inline-flex; width: 34px; height: 34px; flex: 0 0 auto; align-items: center; justify-content: center; overflow: hidden; border-radius: 7px; background: color-mix(in oklab, var(--muted) 74%, transparent); color: var(--muted-foreground); }
.reference-picker-item-icon svg { width: 16px; height: 16px; }
.reference-picker-item-icon img { width: 100%; height: 100%; object-fit: cover; }
.reference-picker-item-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.reference-picker-item-copy > span, .reference-picker-item-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-picker-item-copy > span { font-size: 14px; }
.reference-picker-item-copy small { color: var(--muted-foreground); font-size: 12px; }
.reference-picker-chevron { width: 16px; color: var(--muted-foreground); }
.reference-picker-turn { width: 100%; border-bottom: 1px solid color-mix(in oklab, var(--border) 72%, transparent); padding: 4px 0; }
.reference-picker-turn:last-child { border-bottom: 0; }
.reference-picker-turn-messages { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.reference-picker-turn-preview { display: block; min-width: 0; height: 100%; border-radius: 8px; }
.reference-picker-turn-message { height: 100%; min-height: 64px; align-items: flex-start; }
.reference-picker-turn-message[data-role='user'] { flex-direction: row-reverse; text-align: right; }
.reference-picker-turn-message[data-role='user'] .reference-picker-item-copy { align-items: flex-end; }
.reference-picker-turn-message .reference-picker-item-copy > span { display: -webkit-box; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.reference-picker-turn-empty { min-height: 64px; }
.reference-picker-materials { display: flex; flex-wrap: wrap; gap: 8px; padding: 2px 9px 12px 53px; }
.reference-picker-turn > .reference-picker-materials { padding: 5px 9px 10px; }
.reference-picker-material-preview { display: block; width: 88px; border-radius: 8px; }
.reference-picker-material { display: block; width: 88px; border: 0; background: transparent; padding: 0; color: inherit; text-align: center; cursor: pointer; }
.reference-picker-material-thumb { position: relative; display: flex; width: 88px; height: 88px; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--muted); color: var(--muted-foreground); transition: border-color .16s ease, box-shadow .16s ease; }
.reference-picker-material:hover .reference-picker-material-thumb, .reference-picker-material:focus-visible .reference-picker-material-thumb { border-color: color-mix(in oklab, var(--foreground) 38%, var(--border)); box-shadow: 0 4px 14px rgba(15, 23, 42, .12); }
.reference-picker-material:focus-visible { outline: none; }
.reference-picker-material-thumb > img, .reference-picker-material-thumb > video { width: 100%; height: 100%; object-fit: cover; }
.reference-picker-material-thumb > svg { width: 24px; height: 24px; }
.reference-picker-material-play { position: absolute; top: 50%; left: 50%; display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border-radius: 50%; background: rgba(15, 23, 42, .72); color: #fff; transform: translate(-50%, -50%); pointer-events: none; }
.reference-picker-material-play svg { width: 13px; height: 13px; fill: currentColor; }
.reference-picker-material-label { display: block; overflow: hidden; margin-top: 5px; color: var(--foreground); font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.reference-picker-state { display: flex; min-height: 108px; align-items: center; justify-content: center; color: var(--muted-foreground); font-size: 13px; }
.reference-picker-state svg, .reference-picker-more svg { width: 16px; height: 16px; }
.reference-picker-more { display: flex; width: 100%; min-height: 32px; align-items: center; justify-content: center; gap: 6px; color: var(--muted-foreground); font-size: 13px; }
@media (max-width: 767px) { .reference-composer { min-height: 112px; border-radius: 18px; } .reference-composer-content { min-height: 66px; padding: 14px 16px 6px; } .reference-composer-editor { min-height: 44px; max-height: 132px; } .reference-picker { position: fixed; right: 10px; bottom: calc(118px + env(safe-area-inset-bottom)); left: 10px; } .reference-picker-turn-messages { display: flex; flex-direction: column; gap: 2px; } .reference-picker-turn-preview-user { order: 1; } .reference-picker-turn-preview-assistant { order: 2; } .reference-picker-turn-empty { display: none; } .reference-picker-materials { padding-left: 9px; } }
`
