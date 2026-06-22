import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'
import {
  AlertCircle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CaseSensitive,
  CheckCircle2,
  Code2,
  Columns3,
  Eraser,
  FileImage,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Loader2,
  Music4,
  Newspaper,
  Palette,
  Quote,
  Redo2,
  Rows3,
  SquareCode,
  Strikethrough,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  UploadCloud,
  Video,
  X,
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
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { importArticleFromURL } from '@/lib/article-import'
import {
  normalizeRichTextHexColor,
  richTextLinkClassName,
  richTextFontSizes,
  richTextHighlightColors,
  richTextTextColors,
  type RichTextTextStyleAttrs,
} from '@/lib/rich-text-style'
import {
  isSafeRichTextHref,
  normalizeRichTextHref,
} from '@/lib/rich-text-link'
import { normalizeUploadItem } from '@/lib/resource'
import type { UploadFileItem } from '@/lib/upload'
import { importRemoteFileByRuleStream, uploadFileByRule } from '@/lib/upload'
import { cn } from '@/lib/utils'
import {
  buildEditorMediaInsertContent,
  editorMediaExtensions,
  replaceEditorMediaSource,
  resolveEditorMediaLabel,
  resolveEditorUploadLabel,
  withDefaultEditorUploadRules,
  type EditorMediaKind,
  type EditorUploadRule,
} from './media'
import {
  normalizePastedRichTextHTML,
  pastedMediaAssetKey,
  pastedMediaKindLabel,
  type PastedRemoteMediaAsset,
} from './paste-html'
import { editorTableExtensions } from './table'
import { RichTextArticleBlock, RichTextStyleMark, RichTextTextAlign } from './style'
import {
  inputValue,
  normalizeRichTextEditorValue,
  parseRichTextEditorContent,
  resolveRichTextContentFormat,
  serializeRichTextEditorContent,
  type RichTextContentFormat,
} from './format'
import { inferCodeBlockLanguage } from './code-language'

type TiptapEditor = NonNullable<ReturnType<typeof useEditor>>

type ToolbarItem = {
  icon: LucideIcon
  label: string
  markdown?: boolean
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

type RemoteAssetTransferStatus = 'pending' | 'uploading' | 'done' | 'error'

type RemoteAssetTransferState = {
  status: RemoteAssetTransferStatus
  message?: string
  progress?: number | null
  uploaded?: UploadFileItem
}

const EDITOR_MEDIA_CONTROLS: Array<{
  kind: EditorMediaKind
  icon: LucideIcon
  label: string
}> = [
  { kind: 'image', icon: FileImage, label: '图片' },
  { kind: 'video', icon: Video, label: '视频' },
  { kind: 'audio', icon: Music4, label: '音频' },
]

const TOOLBAR_BUTTON_CLASS =
  'h-7 shrink-0 rounded-md px-2 text-muted-foreground hover:text-foreground'

const HEADING_OPTIONS: Array<{
  label: string
  icon: LucideIcon
  isActive: (editor: TiptapEditor) => boolean
  run: (editor: TiptapEditor) => void
}> = [
  {
    label: '一级标题',
    icon: Heading1,
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: '二级标题',
    icon: Heading2,
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: '三级标题',
    icon: Heading3,
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
]

const ALIGN_OPTIONS: Array<{
  label: string
  value: string
  icon: LucideIcon
}> = [
  { label: '左对齐', value: 'left', icon: AlignLeft },
  { label: '居中', value: 'center', icon: AlignCenter },
  { label: '右对齐', value: 'right', icon: AlignRight },
  { label: '两端对齐', value: 'justify', icon: AlignJustify },
]

const INLINE_FORMAT_OPTIONS: ToolbarItem[] = [
  {
    icon: Bold,
    label: '加粗',
    markdown: true,
    isActive: (editor) => editor.isActive('bold'),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    icon: Italic,
    label: '斜体',
    markdown: true,
    isActive: (editor) => editor.isActive('italic'),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    icon: UnderlineIcon,
    label: '下划线',
    isActive: (editor) => editor.isActive('underline'),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    icon: Strikethrough,
    label: '删除线',
    markdown: true,
    isActive: (editor) => editor.isActive('strike'),
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    icon: Code2,
    label: '行内代码',
    markdown: true,
    isActive: (editor) => editor.isActive('code'),
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    icon: SquareCode,
    label: '代码块',
    markdown: true,
    isActive: (editor) => editor.isActive('codeBlock'),
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    icon: Quote,
    label: '引用',
    markdown: true,
    isActive: (editor) => editor.isActive('blockquote'),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
]

const LIST_OPTIONS: Array<{
  label: string
  icon: LucideIcon
  isActive: (editor: TiptapEditor) => boolean
  run: (editor: TiptapEditor) => void
}> = [
  {
    label: '无序列表',
    icon: List,
    isActive: (editor) => editor.isActive('bulletList'),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: '有序列表',
    icon: ListOrdered,
    isActive: (editor) => editor.isActive('orderedList'),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
]

const editorLowlight = createLowlight(common)
editorLowlight.registerAlias({
  javascript: ['js', 'jsx', 'mjs', 'cjs'],
  markdown: ['md'],
  python: ['py'],
  shell: ['sh', 'zsh'],
  typescript: ['ts', 'tsx'],
  xml: ['html', 'htm', 'xhtml', 'svg'],
  yaml: ['yml'],
})

export type { RichTextContentFormat, RichTextEditorProps }
export { resolveRichTextContentFormat } from './format'
export {
  normalizeEditorUploadRules,
  resolveEditorMediaLabel,
  resolveEditorUploadLabel,
  withDefaultEditorUploadRules,
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
  const richControlsEnabled = format === 'json'
  const normalizedMinHeight = Math.max(Number(minHeight) || 220, 80)
  const normalizedMaxHeight = Math.max(Number(maxHeight) || 560, normalizedMinHeight + 120)
  const contentMaxHeight = Math.max(normalizedMaxHeight - 56, normalizedMinHeight)
  const initialContent = useMemo(
    () => parseRichTextEditorContent(value, format),
    [format, value]
  )
  const effectiveUploadRules = useMemo(
    () => withDefaultEditorUploadRules(uploadRules),
    [uploadRules]
  )
  const uploadRuleMap = useMemo(
    () => new Map(effectiveUploadRules.map((current) => [current.kind, current])),
    [effectiveUploadRules]
  )
  const uploadKinds = useMemo(
    () => effectiveUploadRules.map((current) => current.kind),
    [effectiveUploadRules]
  )
  const inlineFormatOptions = useMemo(
    () =>
      richControlsEnabled
        ? INLINE_FORMAT_OPTIONS
        : INLINE_FORMAT_OPTIONS.filter((option) => option.markdown),
    [richControlsEnabled]
  )
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [activeUploadKind, setActiveUploadKind] = useState<EditorMediaKind | ''>('')
  const [activePickerKind, setActivePickerKind] = useState<EditorMediaKind | ''>('')
  const [uploadingKind, setUploadingKind] = useState<EditorMediaKind | ''>('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [progressText, setProgressText] = useState('')
  const [pastedRemoteAssets, setPastedRemoteAssets] = useState<PastedRemoteMediaAsset[]>([])
  const [remoteAssetState, setRemoteAssetState] = useState<Record<string, RemoteAssetTransferState>>({})
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
  const [linkHref, setLinkHref] = useState('')
  const [articlePopoverOpen, setArticlePopoverOpen] = useState(false)
  const [articleURL, setArticleURL] = useState('')
  const [articleImporting, setArticleImporting] = useState(false)
  const [articleImportError, setArticleImportError] = useState('')
  const selectionRef = useRef<{ from: number; to: number } | null>(null)

  const editorExtensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
        link: {
          autolink: true,
          linkOnPaste: true,
          openOnClick: false,
          defaultProtocol: 'https',
          protocols: ['http', 'https', 'mailto'],
          HTMLAttributes: {
            rel: 'noreferrer',
            target: '_blank',
          },
          isAllowedUri: (url, context) =>
            isSafeRichTextHref(url) &&
            (String(url || '').trim().startsWith('/') || context.defaultValidate(url)),
        },
      }),
      Underline,
      RichTextStyleMark,
      RichTextTextAlign,
      RichTextArticleBlock,
      CodeBlockLowlight.configure({
        lowlight: editorLowlight,
        defaultLanguage: null,
      }).extend({
        addAttributes() {
          return {
            ...(this.parent?.() || {}),
            language: {
              default: null,
              parseHTML: (element) =>
                inferCodeBlockLanguage(
                  element.textContent || '',
                  element.getAttribute('data-language') ||
                    element.querySelector('code')?.className.match(/language-([\w-]+)/)?.[1]
                ) || null,
              rendered: false,
            },
          }
        },
      }),
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
          'tiptap-editor relative text-sm leading-7 outline-none [&_.hljs-attr]:text-sky-700 [&_.hljs-attribute]:text-sky-700 [&_.hljs-built_in]:text-violet-700 [&_.hljs-comment]:text-slate-500 [&_.hljs-keyword]:text-pink-700 [&_.hljs-literal]:text-indigo-700 [&_.hljs-meta]:text-slate-500 [&_.hljs-name]:text-emerald-700 [&_.hljs-number]:text-indigo-700 [&_.hljs-params]:text-slate-700 [&_.hljs-property]:text-sky-700 [&_.hljs-punctuation]:text-slate-500 [&_.hljs-regexp]:text-rose-700 [&_.hljs-selector-class]:text-emerald-700 [&_.hljs-selector-id]:text-emerald-700 [&_.hljs-string]:text-amber-700 [&_.hljs-symbol]:text-violet-700 [&_.hljs-tag]:text-emerald-700 [&_.hljs-title]:text-violet-700 [&_.hljs-type]:text-violet-700 [&_.hljs-variable]:text-orange-700 [&_audio]:my-4 [&_audio]:block [&_audio]:w-full [&_audio]:max-w-md [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-slate-900 [&_h1]:mt-4 [&_h1]:mb-2.5 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_img]:my-4 [&_img]:block [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:min-h-6 [&_pre]:my-4 [&_pre]:max-h-[460px] [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-slate-200 [&_pre]:bg-slate-50 [&_pre]:px-4 [&_pre]:py-3 [&_pre]:shadow-inner [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-sm [&_pre_code]:leading-6 [&_pre_code]:text-slate-900 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_video]:my-4 [&_video]:block [&_video]:max-w-full [&_video]:rounded-lg [&_video]:bg-black/90',
        style: `min-height:${normalizedMinHeight}px`,
      },
      handlePaste: (_view, event) => {
        if (disabled) {
          return false
        }

        const html = event.clipboardData?.getData('text/html')?.trim()
        if (html) {
          const pasted = normalizePastedRichTextHTML(html)
          if (!pasted.html.trim()) {
            return false
          }

          event.preventDefault()
          editor?.chain().focus().insertContent(pasted.html).run()
          appendPastedRemoteAssets(pasted.assets)
          return true
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

    selectionRef.current = null
    editor.commands.setContent(parseRichTextEditorContent(value, format), {
      emitUpdate: false,
      contentType: format,
    })
  }, [editor, format, onChange, value])

  useEffect(() => {
    if (!editor) {
      return
    }

    const rememberNonEmptySelection = () => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        selectionRef.current = { from, to }
      }
    }

    editor.on('selectionUpdate', rememberNonEmptySelection)
    return () => {
      editor.off('selectionUpdate', rememberNonEmptySelection)
    }
  }, [editor])

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

  const appendPastedRemoteAssets = (assets: PastedRemoteMediaAsset[]) => {
    if (!Array.isArray(assets) || assets.length === 0) {
      return
    }

    assets.forEach((asset) => {
      const uploaded = remoteAssetState[pastedMediaAssetKey(asset)]?.uploaded
      if (uploaded && editor) {
        replaceEditorMediaSource(editor, asset.kind, asset.sourceUrl, uploaded)
      }
    })

    setPastedRemoteAssets((current) => {
      const records = new Map(current.map((asset) => [pastedMediaAssetKey(asset), asset]))
      assets.forEach((asset) => {
        const key = pastedMediaAssetKey(asset)
        if (!remoteAssetState[key]?.uploaded) {
          records.set(key, asset)
        }
      })
      return Array.from(records.values())
    })

    setRemoteAssetState((current) => {
      const next = { ...current }
      assets.forEach((asset) => {
        const key = pastedMediaAssetKey(asset)
        if (!next[key]) {
          next[key] = { status: 'pending' }
        }
      })
      return next
    })
  }

  const clearPastedRemoteAssets = () => {
    setPastedRemoteAssets([])
    setRemoteAssetState({})
  }

  const transferPastedRemoteAssets = async () => {
    if (!editor) {
      return
    }

    const queue = pastedRemoteAssets.filter((asset) => {
      const state = remoteAssetState[pastedMediaAssetKey(asset)]
      return (
        state?.status !== 'done' &&
        state?.status !== 'uploading' &&
        !!uploadRuleMap.get(asset.kind)
      )
    })
    if (queue.length === 0) {
      return
    }

    for (const [index, asset] of queue.entries()) {
      const uploadRule = uploadRuleMap.get(asset.kind)
      if (!uploadRule) {
        continue
      }

      const key = pastedMediaAssetKey(asset)
      const defaultMessage = `正在转存${pastedMediaKindLabel(asset.kind)} ${index + 1}/${queue.length}`
      setRemoteAssetState((current) => ({
        ...current,
        [key]: {
          status: 'uploading',
          message: defaultMessage,
          progress: null,
        },
      }))

      try {
        const uploaded = normalizeUploadItem(
          await importRemoteFileByRuleStream(uploadRule.ruleId, asset.sourceUrl, {
            kind: uploadRule.kind || asset.kind,
            name: asset.name,
            bizKey: uploadRule.bizKey,
            bizName: uploadRule.bizName,
            categoryId: uploadRule.categoryId,
            onStatus: (status) => {
              setRemoteAssetState((current) => ({
                ...current,
                [key]: {
                  status: 'uploading',
                  message: status.message || defaultMessage,
                  progress: status.progress,
                },
              }))
            },
          })
        )

        replaceEditorMediaSource(editor, asset.kind, asset.sourceUrl, uploaded)
        setRemoteAssetState((current) => ({
          ...current,
          [key]: {
            status: 'done',
            message: `${pastedMediaKindLabel(asset.kind)}已转存`,
            progress: 100,
            uploaded,
          },
        }))
      } catch (transferError) {
        setRemoteAssetState((current) => ({
          ...current,
          [key]: {
            status: 'error',
            message: transferError instanceof Error ? transferError.message : '转存失败',
            progress: null,
          },
        }))
      }
    }
  }

  const applyRichTextStyle = (attrs: RichTextTextStyleAttrs) => {
    if (!editor || disabled) {
      return
    }
    restoreRememberedSelection()
    editor.chain().focus().setRichTextStyle(attrs).run()
  }

  const applyTextAlign = (align: string) => {
    if (!editor || disabled) {
      return
    }
    restoreRememberedSelection()
    editor.chain().focus().setRichTextAlign(align).run()
  }

  const openLinkEditor = () => {
    if (!editor || disabled) {
      return
    }
    restoreRememberedSelection()
    setLinkHref(String(editor.getAttributes('link')?.href || ''))
    setLinkPopoverOpen(true)
  }

  const applyLink = () => {
    if (!editor || disabled) {
      return
    }
    const href = normalizeRichTextHref(linkHref)
    restoreRememberedSelection()
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkPopoverOpen(false)
      return
    }
    if (!isSafeRichTextHref(href)) {
      setUploadMessage('链接只支持 http、https、mailto 或站内路径。')
      return
    }

    const chain = editor.chain().focus()
    if (editor.state.selection.empty && !editor.isActive('link')) {
      chain.insertContent({
        type: 'text',
        text: href,
        marks: [{ type: 'link', attrs: { href } }],
      }).run()
    } else {
      chain.extendMarkRange('link').setLink({ href }).run()
    }
    setUploadMessage('')
    setLinkPopoverOpen(false)
  }

  const removeLink = () => {
    if (!editor || disabled) {
      return
    }
    restoreRememberedSelection()
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkPopoverOpen(false)
  }

  const importArticleURL = async () => {
    if (!editor || disabled || articleImporting) {
      return
    }

    const url = articleURL.trim()
    if (!url) {
      setArticleImportError('请输入文章链接。')
      return
    }

    setArticleImporting(true)
    setArticleImportError('')
    setUploadMessage('正在导入文章...')
    try {
      const article = await importArticleFromURL(url)
      const pasted = normalizePastedRichTextHTML(article.html)
      if (!pasted.html.trim()) {
        throw new Error('未解析到文章正文')
      }

      editor.chain().focus().insertContent(pasted.html).run()
      appendPastedRemoteAssets([...article.assets, ...pasted.assets])
      setArticleURL('')
      setArticlePopoverOpen(false)
      setUploadMessage(resolveArticleImportMessage(article.assets, pasted.assets))
    } catch (importError) {
      setArticleImportError(importError instanceof Error ? importError.message : '导入文章失败')
      setUploadMessage('')
    } finally {
      setArticleImporting(false)
    }
  }

  const rememberCurrentSelection = () => {
    if (!editor) {
      return
    }
    const { from, to } = editor.state.selection
    if (from !== to) {
      selectionRef.current = { from, to }
      return
    }
    if (editor.isFocused) {
      selectionRef.current = null
    }
  }

  const restoreRememberedSelection = () => {
    if (!editor) {
      return false
    }

    const { from: currentFrom, to: currentTo } = editor.state.selection
    if (currentFrom !== currentTo) {
      selectionRef.current = { from: currentFrom, to: currentTo }
      return true
    }

    if (!selectionRef.current) {
      return false
    }

    const docSize = editor.state.doc.content.size
    const from = Math.max(0, Math.min(selectionRef.current.from, docSize))
    const to = Math.max(0, Math.min(selectionRef.current.to, docSize))
    if (from === to) {
      selectionRef.current = null
      return false
    }
    editor.commands.setTextSelection({ from, to })
    return true
  }

  const runEditorAction = (run: (currentEditor: TiptapEditor) => void) => {
    if (!editor || disabled) {
      return
    }
    restoreRememberedSelection()
    run(editor)
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
          transport: uploadRule.transport,
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
          transport: uploadRule.transport,
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
      <div className="overflow-x-auto border-b border-border/70 bg-muted/35">
        <div className="flex min-w-max items-center gap-1 px-2.5 py-2">
          {HEADING_OPTIONS.map(({ icon, label, isActive, run }) => (
            <EditorToolbarButton
              key={label}
              icon={icon}
              label={label}
              active={!!editor && isActive(editor)}
              disabled={disabled || !editor}
              onPressStart={rememberCurrentSelection}
              onClick={() => runEditorAction(run)}
            />
          ))}
          {richControlsEnabled ? (
            <EditorFontSizeMenu
              disabled={disabled || !editor}
              onPressStart={rememberCurrentSelection}
              onSelect={applyRichTextStyle}
            />
          ) : null}
          <div className="mx-1 h-4 w-px bg-border/70" />
          <EditorInlineFormatMenu
            editor={editor}
            disabled={disabled || !editor}
            options={inlineFormatOptions}
            onPressStart={rememberCurrentSelection}
            onRun={runEditorAction}
          />
          {richControlsEnabled ? (
            <>
              <EditorColorMenu
                disabled={disabled || !editor}
                onPressStart={rememberCurrentSelection}
                onSelect={applyRichTextStyle}
              />
              <EditorAlignMenu
                editor={editor}
                disabled={disabled || !editor}
                onPressStart={rememberCurrentSelection}
                onSelect={applyTextAlign}
              />
            </>
          ) : null}
          <EditorListMenu
            editor={editor}
            disabled={disabled || !editor}
            onPressStart={rememberCurrentSelection}
            onRun={runEditorAction}
          />
          <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={editor?.isActive('link') ? 'secondary' : 'ghost'}
                size="xs"
                className={TOOLBAR_BUTTON_CLASS}
                onMouseDown={(event) => {
                  event.preventDefault()
                  rememberCurrentSelection()
                }}
                onClick={openLinkEditor}
                disabled={disabled || !editor}
                title="链接"
              >
                <Link2 className="size-3.5" />
                <span className="sr-only">链接</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-3">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  applyLink()
                }}
              >
                <Input
                  value={linkHref}
                  onChange={(event) => setLinkHref(event.target.value)}
                  placeholder="https://example.com 或 /path"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeLink}
                    disabled={!editor?.isActive('link')}
                  >
                    <Link2Off className="size-4" />
                    取消链接
                  </Button>
                  <Button type="submit" size="sm">
                    应用
                  </Button>
                </div>
              </form>
            </PopoverContent>
          </Popover>
          {richControlsEnabled ? (
            <Popover
              open={articlePopoverOpen}
              onOpenChange={(open) => {
                setArticlePopoverOpen(open)
                if (open) {
                  setArticleImportError('')
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className={TOOLBAR_BUTTON_CLASS}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    rememberCurrentSelection()
                  }}
                  disabled={disabled || !editor || articleImporting}
                  title="导入文章链接"
                >
                  {articleImporting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Newspaper className="size-3.5" />
                  )}
                  <span className="sr-only">导入文章链接</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-96 p-3">
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void importArticleURL()
                  }}
                >
                  <div className="space-y-1.5">
                    <Input
                      value={articleURL}
                      onChange={(event) => setArticleURL(event.target.value)}
                      placeholder="粘贴微信公众号、百家号或文章页链接"
                      autoFocus
                      disabled={articleImporting}
                    />
                    <p className="text-xs text-muted-foreground">
                      导入后会尽量保留正文结构、图片和可识别媒体；平台内嵌音视频会转成媒体卡片。
                    </p>
                    {articleImportError ? (
                      <p className="text-xs text-destructive">{articleImportError}</p>
                    ) : null}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setArticlePopoverOpen(false)}
                      disabled={articleImporting}
                    >
                      取消
                    </Button>
                    <Button type="submit" size="sm" disabled={articleImporting}>
                      {articleImporting ? <Loader2 className="size-4 animate-spin" /> : null}
                      导入
                    </Button>
                  </div>
                </form>
              </PopoverContent>
            </Popover>
          ) : null}
          {richControlsEnabled
            ? EDITOR_MEDIA_CONTROLS.filter((control) => uploadKinds.includes(control.kind)).map(
                ({ kind, icon: Icon, label }) => (
                  <EditorMediaButton
                    key={kind}
                    icon={Icon}
                    label={label}
                    kind={kind}
                    disabled={disabled || !editor || !!uploadingKind}
                    onUpload={openUploadPicker}
                    onSelectResource={openResourcePicker}
                    renderAiGenerate={() =>
                      renderAiGenerate?.({
                        kind,
                        disabled: !!disabled || !editor || !!uploadingKind,
                        onGenerated: (items) => insertMediaItems(kind, items),
                      })
                    }
                  />
                )
              )
            : null}
          {richControlsEnabled ? (
            <EditorTableMenu editor={editor} disabled={disabled || !editor} />
          ) : null}
          <div className="mx-1 h-4 w-px bg-border/70" />
          <EditorToolbarButton
            icon={Undo2}
            label="撤销"
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().undo().run()}
          />
          <EditorToolbarButton
            icon={Redo2}
            label="重做"
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().redo().run()}
          />
          <EditorToolbarButton
            icon={Eraser}
            label="清除格式"
            disabled={disabled || !editor}
            onPressStart={rememberCurrentSelection}
            onClick={() =>
              runEditorAction((currentEditor) =>
                currentEditor
                  .chain()
                  .focus()
                  .clearNodes()
                  .unsetAllMarks()
                  .clearRichTextAlign()
                  .run()
              )
            }
          />
          {assistantAdornment ? (
            <div className="ms-auto shrink-0">{assistantAdornment}</div>
          ) : null}
        </div>
      </div>
      <RemoteAssetTransferBanner
        assets={pastedRemoteAssets}
        states={remoteAssetState}
        uploadRuleMap={uploadRuleMap}
        disabled={disabled || !editor}
        onTransfer={() => void transferPastedRemoteAssets()}
        onDismiss={clearPastedRemoteAssets}
      />
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
            '[&_.ProseMirror]:before:text-muted-foreground/75',
            richTextLinkClassName
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

function resolveArticleImportMessage(
  articleAssets: PastedRemoteMediaAsset[],
  pastedAssets: PastedRemoteMediaAsset[]
) {
  const records = new Map<string, PastedRemoteMediaAsset>()
  const combinedAssets = [...articleAssets, ...pastedAssets]
  combinedAssets.forEach((asset) => {
    records.set(pastedMediaAssetKey(asset), asset)
  })
  const assets = Array.from(records.values())
  if (assets.length === 0) {
    return '文章已导入。'
  }
  return `文章已导入，检测到 ${formatRemoteAssetCounts(assets)} 来自外部链接。`
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

function RemoteAssetTransferBanner({
  assets,
  states,
  uploadRuleMap,
  disabled,
  onTransfer,
  onDismiss,
}: {
  assets: PastedRemoteMediaAsset[]
  states: Record<string, RemoteAssetTransferState>
  uploadRuleMap: Map<EditorMediaKind, EditorUploadRule>
  disabled?: boolean
  onTransfer: () => void
  onDismiss: () => void
}) {
  if (assets.length === 0) {
    return null
  }

  const activeState = assets
    .map((asset) => states[pastedMediaAssetKey(asset)])
    .find((state) => state?.status === 'uploading')
  const doneCount = assets.filter(
    (asset) => states[pastedMediaAssetKey(asset)]?.status === 'done'
  ).length
  const failedCount = assets.filter(
    (asset) => states[pastedMediaAssetKey(asset)]?.status === 'error'
  ).length
  const pendingAssets = assets.filter(
    (asset) => states[pastedMediaAssetKey(asset)]?.status !== 'done'
  )
  const transferableCount = pendingAssets.filter((asset) =>
    uploadRuleMap.has(asset.kind)
  ).length
  const missingRuleCount = pendingAssets.length - transferableCount
  const transferring = !!activeState
  const completed = doneCount > 0 && doneCount === assets.length
  const message = resolveRemoteAssetBannerMessage({
    assets,
    pendingAssets,
    activeState,
    completed,
  })
  const detail = resolveRemoteAssetBannerDetail({
    failedCount,
    missingRuleCount,
    doneCount,
    totalCount: assets.length,
  })

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm',
        completed
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
          : 'border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100'
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {completed ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
        ) : transferring ? (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-amber-700 dark:text-amber-200" />
        ) : (
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-200" />
        )}
        <div className="min-w-0">
          <p className="font-medium leading-5">{message}</p>
          {detail ? (
            <p className="mt-0.5 text-xs opacity-80">{detail}</p>
          ) : null}
          {transferring && activeState?.progress != null ? (
            <div className="mt-2 h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-background/70">
              <div
                className="h-full rounded-full bg-amber-600 transition-[width] dark:bg-amber-300"
                style={{ width: `${activeState.progress}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!completed && transferableCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              'h-8 shadow-sm',
              failedCount > 0
                ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive dark:text-red-200'
                : 'border-amber-300 bg-white text-amber-950 hover:bg-amber-50 hover:text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-50 dark:hover:bg-amber-900/70'
            )}
            disabled={disabled || transferring}
            onClick={onTransfer}
          >
            {transferring ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {failedCount > 0 ? '重试转存' : '转存全部'}
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={onDismiss}
          title="关闭提示"
        >
          <X className="size-4" />
          <span className="sr-only">关闭提示</span>
        </Button>
      </div>
    </div>
  )
}

function resolveRemoteAssetBannerMessage({
  assets,
  pendingAssets,
  activeState,
  completed,
}: {
  assets: PastedRemoteMediaAsset[]
  pendingAssets: PastedRemoteMediaAsset[]
  activeState?: RemoteAssetTransferState
  completed: boolean
}) {
  if (activeState?.message) {
    return activeState.message
  }
  if (completed) {
    return `已转存 ${assets.length} 个外部资源。`
  }
  return `检测到 ${formatRemoteAssetCounts(pendingAssets)} 来自外部链接，建议转存到资源库。`
}

function resolveRemoteAssetBannerDetail({
  failedCount,
  missingRuleCount,
  doneCount,
  totalCount,
}: {
  failedCount: number
  missingRuleCount: number
  doneCount: number
  totalCount: number
}) {
  const details: string[] = []
  if (doneCount > 0 && doneCount < totalCount) {
    details.push(`${doneCount} 个已转存`)
  }
  if (failedCount > 0) {
    details.push(`${failedCount} 个转存失败`)
  }
  if (missingRuleCount > 0) {
    details.push(`${missingRuleCount} 个缺少对应上传规则`)
  }
  return details.join('，')
}

function formatRemoteAssetCounts(assets: PastedRemoteMediaAsset[]) {
  const counts = new Map<EditorMediaKind, number>()
  assets.forEach((asset) => {
    counts.set(asset.kind, (counts.get(asset.kind) || 0) + 1)
  })

  const parts: string[] = []
  const mediaKinds: EditorMediaKind[] = ['image', 'video', 'audio']
  mediaKinds.forEach((kind) => {
    const count = counts.get(kind) || 0
    if (count > 0) {
      parts.push(`${count} 个${pastedMediaKindLabel(kind)}`)
    }
  })
  return parts.join('、') || `${assets.length} 个资源`
}

function EditorToolbarButton({
  icon: Icon,
  label,
  active,
  disabled,
  onPressStart,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  disabled?: boolean
  onPressStart?: () => void
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="xs"
      className={TOOLBAR_BUTTON_CLASS}
      onMouseDown={(event) => {
        event.preventDefault()
        onPressStart?.()
      }}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <Icon className="size-3.5" />
      <span className="sr-only">{label}</span>
    </Button>
  )
}

function EditorFontSizeMenu({
  disabled,
  onPressStart,
  onSelect,
}: {
  disabled?: boolean
  onPressStart?: () => void
  onSelect: (attrs: { fontSize?: string | null }) => void
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={TOOLBAR_BUTTON_CLASS}
          onMouseDown={(event) => {
            event.preventDefault()
            onPressStart?.()
          }}
          disabled={disabled}
          title="字号"
        >
          <CaseSensitive className="size-3.5" />
          <span className="sr-only">字号</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => onSelect({ fontSize: null })}>
          默认字号
        </DropdownMenuItem>
        {richTextFontSizes.map((fontSize) => (
          <DropdownMenuItem
            key={fontSize.value}
            onSelect={() => onSelect({ fontSize: fontSize.value })}
          >
            <span style={{ fontSize: fontSize.value }}>{fontSize.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditorInlineFormatMenu({
  editor,
  disabled,
  options,
  onPressStart,
  onRun,
}: {
  editor: TiptapEditor | null
  disabled?: boolean
  options: ToolbarItem[]
  onPressStart?: () => void
  onRun: (run: (currentEditor: TiptapEditor) => void) => void
}) {
  const activeOption = editor
    ? options.find((option) => option.isActive(editor))
    : undefined
  const TriggerIcon = activeOption?.icon || Bold

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={activeOption ? 'secondary' : 'ghost'}
          size="xs"
          className={TOOLBAR_BUTTON_CLASS}
          onMouseDown={(event) => {
            event.preventDefault()
            onPressStart?.()
          }}
          disabled={disabled}
          title="行内格式"
        >
          <TriggerIcon className="size-3.5" />
          <span className="sr-only">行内格式</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map(({ icon: Icon, label, isActive, run }) => (
          <DropdownMenuItem
            key={label}
            onSelect={() => onRun(run)}
            className={cn(editor && isActive(editor) && 'bg-accent text-accent-foreground')}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditorColorMenu({
  disabled,
  onPressStart,
  onSelect,
}: {
  disabled?: boolean
  onPressStart?: () => void
  onSelect: (attrs: { color?: string | null; backgroundColor?: string | null }) => void
}) {
  const [open, setOpen] = useState(false)
  const [textColor, setTextColor] = useState(richTextTextColors[0] || '#111827')
  const [highlightColor, setHighlightColor] = useState(richTextHighlightColors[0] || '#fef3c7')
  const applyTextColor = (color: string) => {
    const normalized = normalizeRichTextHexColor(color)
    if (!normalized) {
      return
    }
    setTextColor(normalized)
    onSelect({ color: normalized })
  }
  const applyHighlightColor = (backgroundColor: string) => {
    const normalized = normalizeRichTextHexColor(backgroundColor)
    if (!normalized) {
      return
    }
    setHighlightColor(normalized)
    onSelect({ backgroundColor: normalized })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={TOOLBAR_BUTTON_CLASS}
          onMouseDown={(event) => {
            event.preventDefault()
            onPressStart?.()
          }}
          disabled={disabled}
          title="颜色和高亮"
        >
          <Palette className="size-3.5" />
          <span className="sr-only">颜色和高亮</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <ColorPickerSection
          label="文字颜色"
          value={textColor}
          onChange={applyTextColor}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-2 h-7 w-full justify-start px-2 text-xs"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect({ color: null })}
        >
          清除文字颜色
        </Button>
        <ColorSwatches
          colors={richTextTextColors}
          onSelect={applyTextColor}
        />
        <div className="my-3 h-px bg-border/70" />
        <ColorPickerSection
          label="背景高亮"
          value={highlightColor}
          onChange={applyHighlightColor}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-2 h-7 w-full justify-start px-2 text-xs"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect({ backgroundColor: null })}
        >
          清除背景高亮
        </Button>
        <ColorSwatches
          colors={richTextHighlightColors}
          onSelect={applyHighlightColor}
        />
      </PopoverContent>
    </Popover>
  )
}

function ColorPickerSection({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const applyDraft = () => {
    const normalized = normalizeRichTextHexColor(draft)
    if (!normalized) {
      setDraft(value)
      return
    }
    onChange(normalized)
  }

  return (
    <form
      className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"
      onSubmit={(event) => {
        event.preventDefault()
        applyDraft()
      }}
    >
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          title={label}
        />
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={applyDraft}
          className="h-8 w-24 font-mono text-xs uppercase"
          spellCheck={false}
        />
      </span>
    </form>
  )
}

function ColorSwatches({
  colors,
  onSelect,
}: {
  colors: string[]
  onSelect: (color: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1 px-2 pb-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className="size-5 rounded-full border border-border shadow-xs"
          style={{ backgroundColor: color }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(color)}
          title={color}
        />
      ))}
    </div>
  )
}

function EditorAlignMenu({
  editor,
  disabled,
  onPressStart,
  onSelect,
}: {
  editor: TiptapEditor | null
  disabled?: boolean
  onPressStart?: () => void
  onSelect: (align: string) => void
}) {
  const active = editor
    ? ALIGN_OPTIONS.find((option) =>
        ['paragraph', 'heading', 'tableCell', 'tableHeader'].some((type) =>
          editor.isActive(type, { textAlign: option.value })
        )
      )
    : undefined
  const TriggerIcon = active?.icon || AlignLeft

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={active ? 'secondary' : 'ghost'}
          size="xs"
          className={TOOLBAR_BUTTON_CLASS}
          onMouseDown={(event) => {
            event.preventDefault()
            onPressStart?.()
          }}
          disabled={disabled}
          title="对齐"
        >
          <TriggerIcon className="size-3.5" />
          <span className="sr-only">对齐</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ALIGN_OPTIONS.map(({ icon: Icon, label, value }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => onSelect(value)}
            className={cn(active?.value === value && 'bg-accent text-accent-foreground')}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditorListMenu({
  editor,
  disabled,
  onPressStart,
  onRun,
}: {
  editor: TiptapEditor | null
  disabled?: boolean
  onPressStart?: () => void
  onRun: (run: (currentEditor: TiptapEditor) => void) => void
}) {
  const activeOption = editor ? LIST_OPTIONS.find((option) => option.isActive(editor)) : undefined
  const TriggerIcon = activeOption?.icon || List

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={activeOption ? 'secondary' : 'ghost'}
          size="xs"
          className={TOOLBAR_BUTTON_CLASS}
          onMouseDown={(event) => {
            event.preventDefault()
            onPressStart?.()
          }}
          disabled={disabled}
          title="列表"
        >
          <TriggerIcon className="size-3.5" />
          <span className="sr-only">列表</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LIST_OPTIONS.map(({ icon: Icon, label, isActive, run }) => (
          <DropdownMenuItem
            key={label}
            onSelect={() => onRun(run)}
            className={cn(editor && isActive(editor) && 'bg-accent text-accent-foreground')}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditorMediaButton({
  icon: Icon,
  label,
  kind,
  disabled,
  onUpload,
  onSelectResource,
  renderAiGenerate,
}: {
  icon: LucideIcon
  label: string
  kind: EditorMediaKind
  disabled?: boolean
  onUpload: (kind: EditorMediaKind) => void
  onSelectResource: (kind: EditorMediaKind) => void
  renderAiGenerate: () => ReactNode
}) {
  const aiGenerate = renderAiGenerate()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={TOOLBAR_BUTTON_CLASS}
          onMouseDown={(event) => event.preventDefault()}
          disabled={disabled}
          title={label}
        >
          <Icon className="size-3.5" />
          <span className="sr-only">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => onUpload(kind)}>
          上传{label}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectResource(kind)}>
          从资源库选择{label}
        </DropdownMenuItem>
        {aiGenerate ? <div className="px-1 py-0.5">{aiGenerate}</div> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditorTableMenu({
  editor,
  disabled,
}: {
  editor: TiptapEditor | null
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('3')
  const [withHeaderRow, setWithHeaderRow] = useState(true)
  const inTable = !!editor?.isActive('table')
  const insertTable = () => {
    if (!editor || disabled) {
      return
    }

    const nextRows = normalizeTableDimension(rows)
    const nextCols = normalizeTableDimension(cols)
    setRows(String(nextRows))
    setCols(String(nextCols))
    editor
      .chain()
      .focus()
      .insertRichTextTable({ rows: nextRows, cols: nextCols, withHeaderRow })
      .run()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={inTable ? 'secondary' : 'ghost'}
          size="xs"
          className={TOOLBAR_BUTTON_CLASS}
          onMouseDown={(event) => event.preventDefault()}
          disabled={disabled}
          title="表格"
        >
          <Table2 className="size-3.5" />
          <span className="sr-only">表格</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            insertTable()
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              行数
              <Input
                type="number"
                min={1}
                max={12}
                step={1}
                value={rows}
                onChange={(event) => setRows(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              列数
              <Input
                type="number"
                min={1}
                max={12}
                step={1}
                value={cols}
                onChange={(event) => setCols(event.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={withHeaderRow}
              onChange={(event) => setWithHeaderRow(event.target.checked)}
              className="size-4 rounded border-border"
            />
            首行表头
          </label>
          <Button type="submit" size="sm" className="w-full">
            插入表格
          </Button>
        </form>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!inTable}
            onClick={() => editor?.chain().focus().addRichTextTableRowAfter().run()}
          >
            <Rows3 className="size-4" />
            添加行
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!inTable}
            onClick={() => editor?.chain().focus().addRichTextTableColumnAfter().run()}
          >
            <Columns3 className="size-4" />
            添加列
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!inTable}
            onClick={() => editor?.chain().focus().deleteRichTextTableRow().run()}
          >
            <Rows3 className="size-4" />
            删除行
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!inTable}
            onClick={() => editor?.chain().focus().deleteRichTextTableColumn().run()}
          >
            <Columns3 className="size-4" />
            删除列
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="col-span-2"
            disabled={!inTable}
            onClick={() => editor?.chain().focus().deleteRichTextTable().run()}
          >
            <Trash2 className="size-4" />
            删除表格
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function normalizeTableDimension(value: unknown) {
  const size = Number(value)
  if (!Number.isFinite(size)) {
    return 3
  }
  return Math.max(1, Math.min(12, Math.round(size)))
}
