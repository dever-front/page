import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Eraser,
  FileImage,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Music4,
  Quote,
  Underline as UnderlineIcon,
  Video,
} from 'lucide-react'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import { mergeResourceUploadRules, normalizeResourceUploadRules } from '@/lib/resource'
import { emptyRichTextDoc, parseRichTextDoc, serializeRichTextDoc } from '@/lib/rich-text'
import type { UploadFileItem } from '@/lib/upload'
import { uploadFileByRule } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { ResourcePickerDialogLazy } from '@/components/resource/lazy-dialogs'
import { AssistantMediaGenerateLazyButton } from '@/components/assistant/lazy-media-generate'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NodeItemProps } from '../../nodes'
import {
  buildEditorMediaInsertContent,
  editorMediaExtensions,
  resolveEditorMediaLabel,
  normalizeEditorUploadRules,
  resolveEditorUploadLabel,
  type EditorMediaKind,
} from './editor/media'

type ToolbarItem = {
  icon: typeof Bold
  label: string
  isActive: (editor: NonNullable<ReturnType<typeof useEditor>>) => boolean
  run: (editor: NonNullable<ReturnType<typeof useEditor>>) => void
}

const EDITOR_MEDIA_CONTROLS: Array<{
  kind: EditorMediaKind
  icon: typeof FileImage
  label: string
}> = [
  { kind: 'image', icon: FileImage, label: '图片' },
  { kind: 'video', icon: Video, label: '视频' },
  { kind: 'audio', icon: Music4, label: '音频' },
]

export function FormEditor({ item, value, setValue, error, store }: NodeItemProps) {
  const placeholder = String(item.placeholder || '请输入内容')
  const disabled = !!item.meta?.disabled
  const minHeight = Number(item.meta?.minHeight || 220)
  const maxHeight = Math.max(Number(item.meta?.maxHeight || 560), minHeight + 120)
  const contentMaxHeight = Math.max(maxHeight - 56, minHeight)
  const initialDoc = useMemo(() => parseRichTextDoc(value) || emptyRichTextDoc(), [value])
  const rawUploadRules = useMemo(
    () => normalizeResourceUploadRules(item.meta?.uploadRules),
    [item.meta?.uploadRules]
  )
  const baseUploadRules = useMemo(
    () => normalizeEditorUploadRules(rawUploadRules),
    [rawUploadRules]
  )
  const uploadRuleMetas = useUploadRuleMetas(rawUploadRules.map((current) => current.ruleId))
  const uploadRules = useMemo(
    () => normalizeEditorUploadRules(mergeResourceUploadRules(baseUploadRules, uploadRuleMetas)),
    [baseUploadRules, uploadRuleMetas]
  )
  const uploadRuleMap = useMemo(
    () => new Map(uploadRules.map((current) => [current.kind, current])),
    [uploadRules]
  )
  const uploadKinds = useMemo(
    () => baseUploadRules.map((current) => current.kind),
    [baseUploadRules]
  )
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [activeUploadKind, setActiveUploadKind] = useState<EditorMediaKind | ''>('')
  const [activePickerKind, setActivePickerKind] = useState<EditorMediaKind | ''>('')
  const [uploadingKind, setUploadingKind] = useState<EditorMediaKind | ''>('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [progressText, setProgressText] = useState('')

  const editorExtensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:pointer-events-none before:absolute before:left-0 before:top-0 before:text-muted-foreground/70 before:content-[attr(data-placeholder)]',
      }),
      ...editorMediaExtensions,
    ],
    [placeholder]
  )

  const editor = useEditor({
    editable: !disabled,
    immediatelyRender: false,
    extensions: editorExtensions,
    editorProps: {
      attributes: {
        class:
          'tiptap-editor relative text-sm leading-7 outline-none [&_audio]:my-4 [&_audio]:block [&_audio]:w-full [&_audio]:max-w-md [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_img]:my-4 [&_img]:block [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:min-h-6 [&_ul]:list-disc [&_video]:my-4 [&_video]:block [&_video]:max-w-full [&_video]:rounded-lg [&_video]:bg-black/90',
        style: `min-height:${minHeight}px`,
      },
    },
    content: initialDoc,
    onUpdate({ editor: currentEditor }) {
      setValue(serializeRichTextDoc(currentEditor.getJSON()))
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) {
      return
    }
    const nextDoc = parseRichTextDoc(value) || emptyRichTextDoc()
    const nextValue = serializeRichTextDoc(nextDoc)
    const currentValue = serializeRichTextDoc(editor.getJSON())
    if (inputValue(value) !== nextValue) {
      setValue(nextValue)
    }
    if (nextValue === currentValue) {
      return
    }
    editor.commands.setContent(nextDoc, { emitUpdate: false })
  }, [editor, setValue, value])

  const toolbarItems: ToolbarItem[] = useMemo(
    () => [
      {
        icon: Bold,
        label: '加粗',
        isActive: (currentEditor) => currentEditor.isActive('bold'),
        run: (currentEditor) => currentEditor.chain().focus().toggleBold().run(),
      },
      {
        icon: Italic,
        label: '斜体',
        isActive: (currentEditor) => currentEditor.isActive('italic'),
        run: (currentEditor) => currentEditor.chain().focus().toggleItalic().run(),
      },
      {
        icon: UnderlineIcon,
        label: '下划线',
        isActive: (currentEditor) => currentEditor.isActive('underline'),
        run: (currentEditor) => currentEditor.chain().focus().toggleUnderline().run(),
      },
      {
        icon: Heading2,
        label: '标题',
        isActive: (currentEditor) => currentEditor.isActive('heading', { level: 2 }),
        run: (currentEditor) =>
          currentEditor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        icon: List,
        label: '无序列表',
        isActive: (currentEditor) => currentEditor.isActive('bulletList'),
        run: (currentEditor) => currentEditor.chain().focus().toggleBulletList().run(),
      },
      {
        icon: ListOrdered,
        label: '有序列表',
        isActive: (currentEditor) => currentEditor.isActive('orderedList'),
        run: (currentEditor) => currentEditor.chain().focus().toggleOrderedList().run(),
      },
      {
        icon: Quote,
        label: '引用',
        isActive: (currentEditor) => currentEditor.isActive('blockquote'),
        run: (currentEditor) => currentEditor.chain().focus().toggleBlockquote().run(),
      },
    ],
    []
  )

  const openUploadPicker = (kind: EditorMediaKind) => {
    if (disabled) {
      return
    }
    if (!uploadRuleMap.get(kind)) {
      setUploadMessage(`未配置${resolveEditorUploadLabel(kind)}规则。`)
      return
    }

    setActiveUploadKind(kind)
    setUploadMessage('')
    setProgressText('')
    inputRef.current?.click()
  }

  const openResourcePicker = (kind: EditorMediaKind) => {
    if (disabled) {
      return
    }
    if (!uploadRuleMap.get(kind)) {
      setUploadMessage(`未配置${resolveEditorMediaLabel(kind)}资源规则。`)
      return
    }

    setUploadMessage('')
    setProgressText('')
    setActivePickerKind(kind)
  }

  const insertMediaItems = (kind: EditorMediaKind, items: UploadFileItem[]) => {
    if (!editor) {
      return
    }

    let hasInserted = false
    for (const current of Array.isArray(items) ? items : []) {
      const insertContent = buildEditorMediaInsertContent(current, kind)
      if (insertContent.length === 0) {
        continue
      }

      editor.chain().focus().insertContent(insertContent).run()
      hasInserted = true
    }

    if (hasInserted) {
      setUploadMessage('')
    }
  }

  const handleChooseMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''

    const uploadKind = activeUploadKind
    const uploadRule = uploadKind ? uploadRuleMap.get(uploadKind) : undefined
    if (!editor || !uploadKind || !uploadRule || selectedFiles.length === 0) {
      setActiveUploadKind('')
      return
    }

    setUploadingKind(uploadKind)
    setUploadMessage('')
    setProgressText('')

    try {
      for (const current of selectedFiles) {
        const uploaded = await uploadFileByRule(uploadRule.ruleId, current, {
          kind: uploadRule.kind,
          bizKey: uploadRule.bizKey,
          bizName: uploadRule.bizName,
          categoryId: uploadRule.categoryId,
          onProgress: (loaded, total) => {
            const percent = Math.min(100, Math.round((loaded / Math.max(total, 1)) * 100))
            setProgressText(`${current.name} ${percent}%`)
          },
        })

        insertMediaItems(uploadRule.kind, [uploaded])
      }
    } catch (uploadError) {
      setUploadMessage(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setActiveUploadKind('')
      setUploadingKind('')
      setProgressText('')
    }
  }

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border border-border/70 bg-background shadow-xs transition-[border-color,box-shadow]',
        !disabled && 'focus-within:border-ring/70 focus-within:ring-4 focus-within:ring-ring/10',
        error && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/10',
        item.meta?.controlClassName
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept={activeUploadKind ? uploadRuleMap.get(activeUploadKind)?.accept : undefined}
        onChange={handleChooseMedia}
      />
      <div className="flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/35 px-2.5 py-2">
        {toolbarItems.map(({ icon: Icon, label, isActive, run }) => (
          <Button
            key={label}
            type="button"
            variant={editor && isActive(editor) ? 'secondary' : 'ghost'}
            size="xs"
            className="h-7 rounded-md px-2 text-muted-foreground hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!editor || disabled) {
                return
              }
              run(editor)
            }}
            disabled={disabled || !editor}
            title={label}
          >
            <Icon className="size-3.5" />
            <span className="sr-only">{label}</span>
          </Button>
        ))}
        {uploadKinds.length > 0 ? <div className="mx-1 h-4 w-px bg-border/70" /> : null}
        {EDITOR_MEDIA_CONTROLS.map(({ kind, icon, label }) =>
          uploadKinds.includes(kind) ? (
            <EditorMediaMenuButton
              key={kind}
              icon={icon}
              label={label}
              disabled={disabled || !editor || !!uploadingKind}
              onUpload={() => openUploadPicker(kind)}
              onSelectResource={() => openResourcePicker(kind)}
              aiGenerate={
                <AssistantMediaGenerateLazyButton
                  store={store}
                  item={item}
                  kind={kind}
                  surface="editor"
                  uploadRules={uploadRules}
                  maxResults={4}
                  variant="ghost"
                  size="sm"
                  hideTriggerIcon
                  className="h-auto w-full justify-start rounded-sm px-2 py-1.5 text-sm font-normal text-foreground shadow-none hover:bg-accent hover:text-accent-foreground"
                  disabled={disabled || !editor || !!uploadingKind}
                  onGenerated={(items) => insertMediaItems(kind, items)}
                />
              }
            />
          ) : null
        )}
        {(uploadKinds.length > 0 || toolbarItems.length > 0) ? (
          <div className="mx-1 h-4 w-px bg-border/70" />
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 rounded-md px-2 text-muted-foreground hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!editor || disabled) {
              return
            }
            editor.chain().focus().clearNodes().unsetAllMarks().run()
          }}
          disabled={disabled || !editor}
          title="清除格式"
        >
          <Eraser className="size-3.5" />
          <span className="sr-only">清除格式</span>
        </Button>
      </div>
      {progressText || uploadMessage ? (
        <div className="space-y-1 border-b border-border/70 bg-muted/15 px-4 py-2">
          {progressText ? (
            <p className="text-xs text-muted-foreground">{progressText}</p>
          ) : null}
          {uploadMessage ? (
            <p className="text-xs text-muted-foreground">{uploadMessage}</p>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-y-auto" style={{ maxHeight: contentMaxHeight }}>
        <EditorContent
          editor={editor}
          id={item.id}
          aria-invalid={!!error}
          className={cn(
            'px-4 py-3 text-sm',
            disabled && 'cursor-not-allowed opacity-70',
            '[&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror]:outline-none',
            '[&_.ProseMirror]:before:text-muted-foreground/75'
          )}
          style={{ minHeight }}
        />
      </div>
      {activePickerKind ? (
        <ResourcePickerDialogLazy
          open={!!activePickerKind}
          title={`${resolveEditorMediaLabel(activePickerKind)}资源库`}
          description={`可上传并选择${resolveEditorMediaLabel(activePickerKind)}资源后插入正文。`}
          bizKey={uploadRuleMap.get(activePickerKind)?.bizKey}
          initialScope={uploadRuleMap.get(activePickerKind)?.bizKey ? 'current' : 'all'}
          defaultKind={activePickerKind}
          fixedKind={true}
          value={[]}
          multiple={true}
          maxSelection={20}
          uploadRules={
            uploadRuleMap.get(activePickerKind)
              ? [uploadRuleMap.get(activePickerKind)!]
              : []
          }
          onOpenChange={(open) => {
            if (!open) {
              setActivePickerKind('')
            }
          }}
          onConfirm={(items) => {
            const pickerKind = activePickerKind
            if (!pickerKind) {
              return
            }
            insertMediaItems(pickerKind, items)
            setActivePickerKind('')
          }}
        />
      ) : null}
    </div>
  )
}

function inputValue(value: unknown) {
  if (value == null) {
    return ''
  }
  return typeof value === 'string' ? value.trim() : JSON.stringify(value) || ''
}

function EditorMediaMenuButton({
  icon: Icon,
  label,
  disabled,
  onUpload,
  onSelectResource,
  aiGenerate,
}: {
  icon: typeof FileImage
  label: string
  disabled?: boolean
  onUpload: () => void
  onSelectResource: () => void
  aiGenerate?: ReactNode
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 rounded-md px-2 text-muted-foreground hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          disabled={disabled}
          title={label}
        >
          <Icon className="size-3.5" />
          <span className="sr-only">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={onUpload}>
          上传{label}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSelectResource}>
          从资源库选择{label}
        </DropdownMenuItem>
        {aiGenerate ? <div className="px-1 py-0.5">{aiGenerate}</div> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
