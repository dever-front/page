import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ArrowUp, AtSign, Hash, Loader2, Square } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  clipboardImageFiles,
  clipboardRemoteImageUrl,
} from '@/lib/clipboard'
import { uploadFileByRule, type UploadFileItem } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import {
  buildDefaultParamValues,
  buildRequestInput,
  isFileParam,
  isPromptParam,
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
import {
  referenceDocumentFromContent,
  referenceDocumentFromText,
  referenceLabel,
  referenceTrigger,
} from './text'
import { uploadFileReferenceOptions } from './upload-reference'
import type {
  ReferenceComposerProps,
  ReferenceEditorProps,
  ReferenceContent,
  ReferenceOption,
  ReferenceProvider,
  ReferencePreviewLoader,
  ReferenceScope,
} from './types'

const EMPTY_PARAM_FILES: UploadFileItem[] = []
const CURRENT_REFERENCE_SCOPES: ReferenceScope[] = ['current']

export type {
  ReferenceComposerParam,
  ReferenceComposerProps,
  ReferenceEditorProps,
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
  ReferenceProvider,
  ReferenceProviderPickerProps,
  ReferenceScope,
  ReferenceType,
} from './types'
export { referenceContentFromText } from './text'

export function ReferenceComposer({
  placeholder = '发消息',
  disabled = false,
  running = false,
  stopping = false,
  cancelable = false,
  className,
  layerZIndex,
  clipboardImageUploadRuleId,
  parameters = [],
  providers,
  loadReferences,
  loadPreview,
  onSubmit,
  onCancel,
}: ReferenceComposerProps) {
  const referenceProviders = useMemo(
    () => normalizeReferenceProviders(providers, loadReferences, loadPreview),
    [loadPreview, loadReferences, providers]
  )
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
          !isFileParam(param) &&
          !isPromptParam(param) &&
          type !== 'hidden' &&
          type !== 'description'
        )
      }),
    [normalizedParams]
  )
  const clipboardImageRuleIds = useMemo(() => {
    const ruleId = Number(clipboardImageUploadRuleId || 0)
    return Number.isFinite(ruleId) && ruleId > 0 ? [Math.floor(ruleId)] : []
  }, [clipboardImageUploadRuleId])
  const clipboardImageRuleId = clipboardImageRuleIds[0] || 0
  const clipboardImageRuleMetas = useUploadRuleMetas(clipboardImageRuleIds)
  const clipboardImageRuleMeta = clipboardImageRuleMetas.get(
    clipboardImageRuleId
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTrigger, setPickerTrigger] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadingClipboardImages, setUploadingClipboardImages] =
    useState(false)
  const [message, setMessage] = useState('')
  const [paramValues, setParamValues] = useState<ParamValueMap>({})
  const [attachmentFiles, setAttachmentFiles] = useState<ParamFileMap>({})
  const [attachmentCounts, setAttachmentCounts] = useState<
    Record<string, number>
  >({})
  const submitRef = useRef<() => void>(() => undefined)
  const pasteClipboardImagesRef = useRef<(files: File[]) => boolean>(
    () => false
  )
  const clipboardUploadActiveRef = useRef(false)
  const clipboardPasteDisabledRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pickerOpenRef = useRef(false)
  const loadPreviewRef = useRef<ReferencePreviewLoader>(async (request) => ({
    refType: request.refType,
    refId: request.refId,
    title: request.label,
    text: '',
    media: [],
  }))
  pickerOpenRef.current = pickerOpen
  loadPreviewRef.current = referencePreviewDispatcher(referenceProviders)
  clipboardPasteDisabledRef.current =
    disabled || running || submitting || uploadingClipboardImages
  const editor = useEditor({
    immediatelyRender: false,
    extensions: referenceEditorExtensions(placeholder, (request) =>
      loadPreviewRef.current(request)
    ),
    editorProps: {
      attributes: {
        class: 'reference-composer-editor',
        'aria-label': placeholder,
      },
      handleTextInput(_view, _from, _to, text) {
        const provider = referenceProviderForTrigger(referenceProviders, text)
        if (!provider) {
          return false
        }
        setPickerTrigger(provider.trigger)
        setPickerOpen(true)
        return true
      },
      handlePaste(view, event) {
        if (clipboardPasteDisabledRef.current) {
          return false
        }
        const remoteImageUrl = clipboardRemoteImageUrl(event.clipboardData)
        if (remoteImageUrl) {
          event.preventDefault()
          view.dispatch(view.state.tr.insertText(remoteImageUrl))
          setMessage('')
          return true
        }
        const imageFiles = clipboardImageFiles(event.clipboardData)
        if (
          imageFiles.length === 0 ||
          !pasteClipboardImagesRef.current(imageFiles)
        ) {
          return false
        }
        event.preventDefault()
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
    editor?.setEditable(
      !disabled && !running && !submitting && !uploadingClipboardImages
    )
  }, [disabled, editor, running, submitting, uploadingClipboardImages])

  useEffect(() => {
    if (!pickerOpen) {
      return
    }
    if (
      referenceProviderForTrigger(referenceProviders, pickerTrigger)
        ?.renderPicker
    ) {
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
  }, [pickerOpen, pickerTrigger, referenceProviders])

  const submit = useCallback(async () => {
    if (
      !editor ||
      disabled ||
      running ||
      submitting ||
      uploadingClipboardImages
    ) {
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
      setPickerTrigger('')
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
    uploadingClipboardImages,
  ])
  submitRef.current = () => void submit()

  const insertReference = useCallback(
    (option: ReferenceOption) => {
      if (!editor || option.selectable === false) {
        return
      }
      const provider = referenceProviderForTrigger(
        referenceProviders,
        pickerTrigger
      )
      editor
        .chain()
        .focus()
        .insertContent(
          referenceInsertionContent([
            { ...option, trigger: option.trigger || provider?.trigger || '@' },
          ])
        )
        .run()
      setPickerOpen(false)
      setPickerTrigger('')
    },
    [editor, pickerTrigger, referenceProviders]
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
      const content = referenceInsertionContent(
        nextOptions.map((option) =>
          referenceOptionWithProviderTrigger(option, referenceProviders)
        ),
        key
      )
      if (content.length > 0) {
        editor.chain().focus().insertContent(content).run()
      }
      setMessage('')
    },
    [editor, referenceProviders]
  )

  const uploadClipboardImages = useCallback(
    async (files: File[]) => {
      if (!editor || files.length === 0) {
        return
      }
      if (!clipboardImageRuleId) {
        setMessage('当前聊天未配置剪贴板图片上传规则。')
        return
      }

      clipboardUploadActiveRef.current = true
      setUploadingClipboardImages(true)
      setMessage('')
      try {
        const uploadedFiles: UploadFileItem[] = []
        for (const file of files) {
          uploadedFiles.push(
            await uploadFileByRule(clipboardImageRuleId, file, {
              kind: 'image',
              transport: clipboardImageRuleMeta?.transport,
            })
          )
        }
        if (editor.isDestroyed) {
          return
        }
        const options = uploadFileReferenceOptions(uploadedFiles, {
          fallbackKind: 'image',
        })
        if (options.length === 0) {
          throw new Error('图片上传完成，但未返回可引用的文件。')
        }
        editor
          .chain()
          .focus()
          .insertContent(
            referenceInsertionContent(
              options.map((option) =>
                referenceOptionWithProviderTrigger(option, referenceProviders)
              )
            )
          )
          .run()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '图片上传失败。')
      } finally {
        clipboardUploadActiveRef.current = false
        setUploadingClipboardImages(false)
      }
    },
    [
      clipboardImageRuleId,
      clipboardImageRuleMeta?.transport,
      editor,
      referenceProviders,
    ]
  )
  pasteClipboardImagesRef.current = (files) => {
    if (!editor || disabled || running || submitting) {
      return false
    }
    if (clipboardUploadActiveRef.current) {
      setMessage('图片正在上传，请稍后再粘贴。')
      return true
    }
    void uploadClipboardImages(files)
    return true
  }

  const composerDisabled =
    disabled || submitting || uploadingClipboardImages
  const activeProvider = referenceProviderForTrigger(
    referenceProviders,
    pickerTrigger
  )
  return (
    <div ref={rootRef} className={cn('reference-composer', className)}>
      {pickerOpen && activeProvider
        ? renderReferenceProviderPicker(activeProvider, {
            open: pickerOpen,
            onSelect: insertReference,
            onClose: () => setPickerOpen(false),
          })
        : null}
      <EditorContent
        editor={editor}
        className='reference-composer-content'
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Escape') {
            setPickerOpen(false)
            setPickerTrigger('')
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
          {referenceProviders.map((provider) => (
            <button
              key={provider.trigger}
              type='button'
              className='reference-composer-tool'
              title={
                provider.trigger === '#' ? '引用会话信息' : '引用资产'
              }
              disabled={composerDisabled || running}
              onClick={() => {
                const sameProvider = pickerTrigger === provider.trigger
                setPickerTrigger(provider.trigger)
                setPickerOpen((open) => (sameProvider ? !open : true))
              }}
            >
              {provider.trigger === '#' ? <Hash /> : <AtSign />}
            </button>
          ))}
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
            title={uploadingClipboardImages ? '正在上传图片' : '发送'}
            disabled={composerDisabled}
            onClick={() => void submit()}
          >
            {submitting || uploadingClipboardImages ? (
              <Loader2 className='animate-spin' />
            ) : (
              <ArrowUp />
            )}
          </button>
        )}
      </div>
      <style>{referenceComposerStyles}</style>
    </div>
  )
}

export function ReferenceEditor({
  value,
  content,
  references,
  placeholder = '输入内容，使用 @ 引用',
  disabled = false,
  autoFocus = false,
  className,
  layerZIndex = 2200,
  pickerScopes = CURRENT_REFERENCE_SCOPES,
  pickerSearchPlaceholder = '搜索可引用内容',
  providers,
  loadReferences,
  loadPreview,
  onChange,
  onSubmit,
}: ReferenceEditorProps) {
  const referenceProviders = useMemo(
    () =>
      normalizeReferenceProviders(providers, loadReferences, loadPreview, {
        availableScopes: pickerScopes,
        searchPlaceholder: pickerSearchPlaceholder,
      }),
    [
      loadPreview,
      loadReferences,
      pickerScopes,
      pickerSearchPlaceholder,
      providers,
    ]
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTrigger, setPickerTrigger] = useState('')
  const [pickerPosition, setPickerPosition] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
  }>()
  const rootRef = useRef<HTMLDivElement>(null)
  const pickerLayerRef = useRef<HTMLDivElement>(null)
  const pickerOpenRef = useRef(false)
  const synchronizingRef = useRef(false)
  const valueRef = useRef(value)
  const contentRef = useRef(content)
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)
  const loadPreviewRef = useRef<ReferencePreviewLoader>(async (request) => ({
    refType: request.refType,
    refId: request.refId,
    title: request.label,
    text: '',
    media: [],
  }))
  pickerOpenRef.current = pickerOpen
  valueRef.current = value
  contentRef.current = content
  onChangeRef.current = onChange
  onSubmitRef.current = onSubmit
  loadPreviewRef.current = referencePreviewDispatcher(referenceProviders)
  const referenceSignature = useMemo(
    () =>
      references
        .map((item) =>
          [
            item.key,
            item.refType,
            item.refId,
            item.label,
            item.preview?.kind,
            item.preview?.url,
            item.preview?.text,
          ].join(':')
        )
        .join('|'),
    [references]
  )
  const appliedReferenceSignatureRef = useRef('')
  const controlledContentSignature = referenceContentSignature(content)
  const editor = useEditor({
    immediatelyRender: false,
    content: referenceEditorDocument(value, content, references),
    extensions: referenceEditorExtensions(placeholder, (request) =>
      loadPreviewRef.current(request)
    ),
    editorProps: {
      attributes: {
        class: 'reference-composer-editor reference-text-editor-input',
        'aria-label': placeholder,
      },
      handleTextInput(_view, _from, _to, text) {
        const provider = referenceProviderForTrigger(referenceProviders, text)
        if (!provider) {
          return false
        }
        setPickerTrigger(provider.trigger)
        setPickerOpen(true)
        return true
      },
      handleKeyDown(_view, event) {
        if (event.key === 'Escape' && pickerOpenRef.current) {
          event.preventDefault()
          setPickerOpen(false)
          return true
        }
        if (
          event.key === 'Enter' &&
          (event.metaKey || event.ctrlKey) &&
          !event.isComposing &&
          !pickerOpenRef.current &&
          onSubmitRef.current
        ) {
          event.preventDefault()
          onSubmitRef.current()
          return true
        }
        return false
      },
    },
    onUpdate({ editor: currentEditor }) {
      if (synchronizingRef.current) {
        return
      }
      const input = serializeReferenceDocument(currentEditor.getJSON(), {
        trimBoundary: false,
      })
      if (
        input.text === valueRef.current &&
        referenceContentSignature(input.content) ===
          referenceContentSignature(contentRef.current)
      ) {
        return
      }
      valueRef.current = input.text
      contentRef.current = input.content
      onChangeRef.current(input.text, input.content)
    },
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) {
      return
    }
    const currentInput = serializeReferenceDocument(editor.getJSON(), {
      trimBoundary: false,
    })
    if (
      currentInput.text === value &&
      referenceContentSignature(currentInput.content) ===
        controlledContentSignature &&
      appliedReferenceSignatureRef.current === referenceSignature
    ) {
      return
    }
    synchronizingRef.current = true
    editor.commands.setContent(
      referenceEditorDocument(value, content, references),
      { emitUpdate: false }
    )
    synchronizingRef.current = false
    valueRef.current = value
    contentRef.current = content
    appliedReferenceSignatureRef.current = referenceSignature
  }, [
    content,
    controlledContentSignature,
    editor,
    referenceSignature,
    references,
    value,
  ])

  useEffect(() => {
    if (autoFocus && editor && !disabled) {
      editor.commands.focus('end')
    }
  }, [autoFocus, disabled, editor])

  useEffect(() => {
    if (!pickerOpen) {
      return
    }
    if (
      referenceProviderForTrigger(referenceProviders, pickerTrigger)
        ?.renderPicker
    ) {
      return
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !rootRef.current?.contains(target) &&
        !pickerLayerRef.current?.contains(target)
      ) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [pickerOpen, pickerTrigger, referenceProviders])

  useLayoutEffect(() => {
    if (!pickerOpen) {
      setPickerPosition(undefined)
      return
    }
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }
      const viewportPadding = 12
      const width = Math.min(
        560,
        Math.max(320, rect.width),
        window.innerWidth - viewportPadding * 2
      )
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding
      )
      const openAbove = window.innerHeight - rect.bottom < 340 && rect.top > 340
      setPickerPosition({
        left,
        width,
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
      })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [pickerOpen])

  const insertReference = useCallback(
    (option: ReferenceOption) => {
      if (!editor || option.selectable === false) {
        return
      }
      const provider = referenceProviderForTrigger(
        referenceProviders,
        pickerTrigger
      )
      editor
        .chain()
        .focus()
        .insertContent(
          referenceInsertionContent(
            [{ ...option, trigger: option.trigger || provider?.trigger || '@' }],
            '',
            false
          )
        )
        .run()
      setPickerOpen(false)
      setPickerTrigger('')
    },
    [editor, pickerTrigger, referenceProviders]
  )

  const activeProvider = referenceProviderForTrigger(
    referenceProviders,
    pickerTrigger
  )

  return (
    <div
      ref={rootRef}
      className={cn('reference-text-editor', className)}
      data-disabled={disabled || undefined}
    >
      <EditorContent
        editor={editor}
        className='reference-text-editor-content'
      />
      {pickerOpen && activeProvider?.renderPicker
        ? activeProvider.renderPicker({
            open: true,
            onSelect: insertReference,
            onClose: () => setPickerOpen(false),
          })
        : null}
      {pickerOpen &&
      activeProvider &&
      !activeProvider.renderPicker &&
      pickerPosition &&
      typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={pickerLayerRef}
              className='reference-editor-picker-layer'
              style={{
                position: 'fixed',
                zIndex: layerZIndex,
                ...pickerPosition,
              }}
            >
              <ReferencePicker
                open
                availableScopes={
                  activeProvider.availableScopes || CURRENT_REFERENCE_SCOPES
                }
                searchPlaceholder={
                  activeProvider.searchPlaceholder || '搜索可引用内容'
                }
                loadReferences={requiredReferenceLoader(activeProvider)}
                loadPreview={
                  activeProvider.loadPreview ||
                  referencePreviewDispatcher(referenceProviders)
                }
                onSelect={insertReference}
                onClose={() => setPickerOpen(false)}
              />
            </div>,
            document.body
          )
        : null}
      <style>{referenceComposerStyles}</style>
    </div>
  )
}

function referenceEditorDocument(
  value: string,
  content: ReferenceContent | undefined,
  references: ReferenceOption[]
) {
  return content?.version === 1
    ? referenceDocumentFromContent(content, references)
    : referenceDocumentFromText(value, references)
}

function referenceContentSignature(content: ReferenceContent | undefined) {
  if (!content?.parts?.length) {
    return ''
  }
  return content.parts
    .map((part) =>
      part.type === 'text'
        ? `text:${part.text}`
        : `${part.ref_type}:${part.ref_id}:${part.usage || ''}:${
            part.ref_trigger || '@'
          }:${part.ref_version_id || 0}`
    )
    .join('|')
}

function referenceEditorExtensions(
  placeholder: string,
  loadPreview: ReferencePreviewLoader
) {
  return [
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
    ReferenceNode.configure({ loadPreview }),
  ]
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
  defaultUsage = '',
  leadingSpace = true
) {
  if (options.length === 0) {
    return []
  }
  const content: import('@tiptap/core').JSONContent[] = leadingSpace
    ? [textNode(' ')]
    : []
  options.forEach((option, index) => {
    if (index > 0) {
      content.push(textNode(' '))
    }
    content.push({
      type: 'reference',
      attrs: {
        refType: option.refType,
        refId: option.refId,
        label: referenceLabel(option.label),
        usage: option.usage || defaultUsage,
        trigger: referenceTrigger(option.trigger),
        versionId: Number(option.versionID || 0),
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
            label={`${referenceTrigger(part.ref_trigger)}${referenceLabel(part.label)}`}
            refType={part.ref_type}
            refId={part.ref_id}
            trigger={referenceTrigger(part.ref_trigger)}
            versionId={part.ref_version_id}
            loadPreview={loadPreview}
          />
        ) : (
          <span key={`text-${index}`}>{part.text}</span>
        )
      )}
    </>
  )
}

function normalizeReferenceProviders(
  providers: ReferenceProvider[] | undefined,
  loadReferences: ReferenceComposerProps['loadReferences'],
  loadPreview: ReferenceComposerProps['loadPreview'],
  defaults: Pick<
    ReferenceProvider,
    'availableScopes' | 'searchPlaceholder'
  > = {}
): ReferenceProvider[] {
  const normalized = (providers || [])
    .map((provider) => ({
      ...provider,
      trigger: referenceTrigger(provider.trigger),
      referenceTypes: [...new Set(provider.referenceTypes || [])],
    }))
    .filter(
      (provider, index, rows) =>
        provider.referenceTypes.length > 0 &&
        rows.findIndex((current) => current.trigger === provider.trigger) ===
          index
    )
  if (normalized.length > 0) {
    return normalized
  }
  if (!loadReferences) {
    return []
  }
  return [
    {
      trigger: '@',
      referenceTypes: [
        'message',
        'artifact',
        'upload_file',
        'session',
        'canvas_node',
        'asset',
      ],
      loadReferences,
      loadPreview,
      ...defaults,
    } satisfies ReferenceProvider,
  ]
}

function referenceProviderForTrigger(
  providers: ReferenceProvider[],
  trigger: string
) {
  return providers.find((provider) => provider.trigger === trigger)
}

function referenceOptionWithProviderTrigger(
  option: ReferenceOption,
  providers: ReferenceProvider[]
) {
  if (option.trigger) {
    return option
  }
  const provider = providers.find((current) =>
    current.referenceTypes.includes(option.refType)
  )
  return { ...option, trigger: provider?.trigger || '@' }
}

function referencePreviewDispatcher(
  providers: ReferenceProvider[]
): ReferencePreviewLoader {
  return async (request) => {
    const provider = providers.find((current) =>
      current.referenceTypes.includes(request.refType)
    )
    if (provider?.loadPreview) {
      return provider.loadPreview(request)
    }
    return {
      refType: request.refType,
      refId: request.refId,
      title: request.label,
      text: '',
      media: [],
    }
  }
}

function requiredReferenceLoader(provider: ReferenceProvider) {
  return provider.loadReferences || (async () => ({ items: [] }))
}

function renderReferenceProviderPicker(
  provider: ReferenceProvider,
  props: import('./types').ReferenceProviderPickerProps
) {
  if (provider.renderPicker) {
    return provider.renderPicker(props)
  }
  return (
    <ReferencePicker
      open={props.open}
      availableScopes={provider.availableScopes}
      searchPlaceholder={provider.searchPlaceholder}
      loadReferences={requiredReferenceLoader(provider)}
      loadPreview={provider.loadPreview || referencePreviewDispatcher([provider])}
      onSelect={props.onSelect}
      onClose={props.onClose}
    />
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
.reference-text-editor { position: relative; width: 100%; min-width: 0; min-height: 100%; }
.reference-text-editor-content { min-height: 100%; }
.reference-text-editor-input { box-sizing: border-box; width: 100%; min-height: 100%; max-height: 240px; padding: 8px 10px; border: 1px solid transparent; border-radius: 6px; background: transparent; font-size: inherit; line-height: inherit; }
.reference-text-editor-input:focus { border-color: color-mix(in oklab, var(--foreground) 22%, var(--border)); background: var(--background); box-shadow: 0 0 0 2px color-mix(in oklab, var(--foreground) 8%, transparent); }
.reference-text-editor-input .reference-node-view { display: inline-flex; margin: 1px 2px; vertical-align: middle; }
.reference-text-editor[data-disabled='true'] { opacity: .62; }
.reference-editor-picker-layer .reference-picker { position: relative; bottom: auto; left: auto; width: 100%; }
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
