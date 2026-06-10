import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code2,
  Eraser,
  FileImage,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Music4,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { ResourcePickerDialogLazy } from '@/components/resource/lazy-dialogs'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { UploadFileItem } from '@/lib/upload'
import { uploadFileByRule } from '@/lib/upload'
import { cn } from '@/lib/utils'
import {
  buildEditorMediaInsertContent,
  editorMediaExtensions,
  resolveEditorMediaLabel,
  resolveEditorUploadLabel,
  type EditorMediaKind,
  type EditorUploadRule,
} from './media'
import { editorTableExtensions } from './table'
import {
  inputValue,
  normalizeRichTextEditorValue,
  parseRichTextEditorContent,
  resolveRichTextContentFormat,
  serializeRichTextEditorContent,
  type RichTextContentFormat,
} from './format'

type TiptapEditor = NonNullable<ReturnType<typeof useEditor>>

type ToolbarItem = {
  icon: LucideIcon
  label: string
  isActive: (editor: TiptapEditor) => boolean
  run: (editor: TiptapEditor) => void
}

type RichTextEditorProps = {
  id?: string
  value: unknown
  onChange: (value: string) => void
  contentFormat?: RichTextContentFormat
  placeholder?: string
  disabled?: boolean
  error?: boolean
  minHeight?: number
  maxHeight?: number
  className?: string
  controlClassName?: string
  uploadRules?: EditorUploadRule[]
  assistantAdornment?: ReactNode
  renderAiGenerate?: (input: {
    kind: EditorMediaKind
    disabled: boolean
    onGenerated: (items: UploadFileItem[]) => void
  }) => ReactNode
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

export type { RichTextContentFormat, RichTextEditorProps }
export { resolveRichTextContentFormat } from './format'
export {
  normalizeEditorUploadRules,
  resolveEditorMediaLabel,
  resolveEditorUploadLabel,
  type EditorMediaKind,
  type EditorUploadRule,
} from './media'

export function RichTextEditor({
  id,
  value,
  onChange,
  contentFormat,
  placeholder = '请输入内容',
  disabled,
  error,
  minHeight = 220,
  maxHeight = 560,
  className,
  controlClassName,
  uploadRules = [],
  assistantAdornment,
  renderAiGenerate,
}: RichTextEditorProps) {
  const format = resolveRichTextContentFormat(contentFormat)
  const normalizedMinHeight = Math.max(Number(minHeight) || 220, 80)
  const normalizedMaxHeight = Math.max(Number(maxHeight) || 560, normalizedMinHeight + 120)
  const contentMaxHeight = Math.max(normalizedMaxHeight - 56, normalizedMinHeight)
  const initialContent = useMemo(
    () => parseRichTextEditorContent(value, format),
    [format, value]
  )
  const uploadRuleMap = useMemo(
    () => new Map(uploadRules.map((current) => [current.kind, current])),
    [uploadRules]
  )
  const uploadKinds = useMemo(
    () => uploadRules.map((current) => current.kind),
    [uploadRules]
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
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Markdown,
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:pointer-events-none before:absolute before:left-0 before:top-0 before:text-muted-foreground/70 before:content-[attr(data-placeholder)]',
      }),
      ...editorMediaExtensions,
      ...editorTableExtensions,
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
          'tiptap-editor relative text-sm leading-7 outline-none [&_audio]:my-4 [&_audio]:block [&_audio]:w-full [&_audio]:max-w-md [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_img]:my-4 [&_img]:block [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:min-h-6 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_video]:my-4 [&_video]:block [&_video]:max-w-full [&_video]:rounded-lg [&_video]:bg-black/90',
        style: `min-height:${normalizedMinHeight}px`,
      },
      handlePaste: (_view, event) => {
        if (disabled || event.clipboardData?.getData('text/html')?.trim()) {
          return false
        }

        const files = clipboardImageFiles(event.clipboardData)
        if (files.length === 0) {
          return false
        }

        event.preventDefault()
        void uploadPastedImages(files)
        return true
      },
    },
    content: initialContent,
    contentType: format,
    onUpdate({ editor: currentEditor }) {
      onChange(serializeRichTextEditorContent(currentEditor, format))
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

    const nextValue = normalizeRichTextEditorValue(value, format)
    const currentValue = serializeRichTextEditorContent(editor, format)
    if (format === 'json' && inputValue(value) !== nextValue) {
      onChange(nextValue)
    }
    if (nextValue === currentValue) {
      return
    }

    editor.commands.setContent(parseRichTextEditorContent(value, format), {
      emitUpdate: false,
      contentType: format,
    })
  }, [editor, format, onChange, value])

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
        icon: Strikethrough,
        label: '删除线',
        isActive: (currentEditor) => currentEditor.isActive('strike'),
        run: (currentEditor) => currentEditor.chain().focus().toggleStrike().run(),
      },
      {
        icon: Code2,
        label: '行内代码',
        isActive: (currentEditor) => currentEditor.isActive('code'),
        run: (currentEditor) => currentEditor.chain().focus().toggleCode().run(),
      },
      {
        icon: Heading1,
        label: '一级标题',
        isActive: (currentEditor) => currentEditor.isActive('heading', { level: 1 }),
        run: (currentEditor) =>
          currentEditor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        icon: Heading2,
        label: '二级标题',
        isActive: (currentEditor) => currentEditor.isActive('heading', { level: 2 }),
        run: (currentEditor) =>
          currentEditor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        icon: Heading3,
        label: '三级标题',
        isActive: (currentEditor) => currentEditor.isActive('heading', { level: 3 }),
        run: (currentEditor) =>
          currentEditor.chain().focus().toggleHeading({ level: 3 }).run(),
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
      {
        icon: Undo2,
        label: '撤销',
        isActive: () => false,
        run: (currentEditor) => currentEditor.chain().focus().undo().run(),
      },
      {
        icon: Redo2,
        label: '重做',
        isActive: () => false,
        run: (currentEditor) => currentEditor.chain().focus().redo().run(),
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

  async function uploadPastedImages(files: File[]) {
    const uploadRule = uploadRuleMap.get('image')
    if (!editor || !uploadRule || files.length === 0) {
      setUploadMessage('未配置图片上传规则。')
      return
    }

    setUploadingKind('image')
    setUploadMessage('')
    setProgressText('')

    try {
      for (const current of files) {
        const uploaded = await uploadFileByRule(uploadRule.ruleId, current, {
          kind: uploadRule.kind,
          bizKey: uploadRule.bizKey,
          bizName: uploadRule.bizName,
          categoryId: uploadRule.categoryId,
          onProgress: (loaded, total) => {
            const percent = Math.min(100, Math.round((loaded / Math.max(total, 1)) * 100))
            setProgressText(`${current.name || '剪贴板图片'} ${percent}%`)
          },
        })

        insertMediaItems('image', [uploaded])
      }
    } catch (uploadError) {
      setUploadMessage(uploadError instanceof Error ? uploadError.message : '图片粘贴上传失败')
    } finally {
      setUploadingKind('')
      setProgressText('')
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
        controlClassName,
        className
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
              aiGenerate={renderAiGenerate?.({
                kind,
                disabled: !!disabled || !editor || !!uploadingKind,
                onGenerated: (items) => insertMediaItems(kind, items),
              })}
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
        {assistantAdornment ? <div className="ms-auto">{assistantAdornment}</div> : null}
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
          id={id}
          editor={editor}
          aria-invalid={!!error}
          className={cn(
            'px-4 py-3 text-sm',
            disabled && 'cursor-not-allowed opacity-70',
            '[&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror]:outline-none',
            '[&_.ProseMirror]:before:text-muted-foreground/75'
          )}
          style={{ minHeight: normalizedMinHeight }}
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

function clipboardImageFiles(data: DataTransfer | null) {
  if (!data) {
    return []
  }

  const files = Array.from(data.files || []).filter((file) => file.type.startsWith('image/'))
  if (files.length > 0) {
    return files
  }

  return Array.from(data.items || [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file != null)
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
