import { useEffect, useMemo } from 'react'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Eraser,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

type ToolbarItem = {
  icon: typeof Bold
  label: string
  isActive: (editor: NonNullable<ReturnType<typeof useEditor>>) => boolean
  run: (editor: NonNullable<ReturnType<typeof useEditor>>) => void
}

export function FormEditor({ item, value, setValue, error }: NodeItemProps) {
  const placeholder = String(item.placeholder || '请输入内容')
  const disabled = !!item.meta?.disabled
  const minHeight = Number(item.meta?.minHeight || 220)
  const initialHtml = useMemo(() => normalizeEditorHtml(String(value ?? '')), [value])

  const editor = useEditor({
    editable: !disabled,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:pointer-events-none before:absolute before:left-0 before:top-0 before:text-muted-foreground/70 before:content-[attr(data-placeholder)]',
      }),
    ],
    editorProps: {
      attributes: {
        class:
          'tiptap-editor relative text-sm leading-7 outline-none [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:min-h-6 [&_ul]:list-disc',
        style: `min-height:${minHeight}px`,
      },
    },
    content: initialHtml,
    onUpdate({ editor: currentEditor }) {
      setValue(normalizeEditorHtml(currentEditor.getHTML()))
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
    const nextHtml = normalizeEditorHtml(String(value ?? ''))
    const currentHtml = normalizeEditorHtml(editor.getHTML())
    if (nextHtml === currentHtml) {
      return
    }
    editor.commands.setContent(nextHtml || '', false)
  }, [editor, value])

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

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border border-border/70 bg-background shadow-xs transition-[border-color,box-shadow]',
        !disabled && 'focus-within:border-ring/70 focus-within:ring-4 focus-within:ring-ring/10',
        error && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/10',
        item.meta?.controlClassName
      )}
    >
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
        <div className="mx-1 h-4 w-px bg-border/70" />
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
  )
}

function normalizeEditorHtml(input: string) {
  const html = String(input || '').trim()
  if (!html || isEditorHtmlEmpty(html)) {
    return ''
  }
  return html
}

function isEditorHtmlEmpty(input: string) {
  const html = String(input || '')
    .replace(/<p><br><\/p>/gi, '')
    .replace(/<div><br><\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return html.length === 0
}
