import { Fragment, type CSSProperties, createElement, type ReactNode, useMemo } from 'react'
import {
  isEmptyRichTextDoc,
  normalizeRichTextMaxWidth,
  parseRichTextDoc,
  richTextMediaNodeNames,
  type RichTextMark,
  type RichTextNode,
} from '@/lib/rich-text'
import { cn } from '@/lib/utils'

type RichTextViewProps = {
  value: unknown
  className?: string
  preview?: boolean
}

export function RichTextView({ value, className, preview }: RichTextViewProps) {
  const doc = useMemo(() => parseRichTextDoc(value), [value])

  if (!doc || isEmptyRichTextDoc(doc)) {
    return null
  }

  return (
    <div className={cn(richTextClassName, preview && previewClassName, className)}>
      {renderRichTextDoc(doc)}
    </div>
  )
}

const richTextClassName = cn(
  'min-w-0 text-sm leading-6 text-foreground',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4',
  '[&_audio]:my-4 [&_audio]:block [&_audio]:w-full [&_audio]:max-w-sm',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border',
  '[&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em]',
  '[&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold',
  '[&_h2]:mb-2.5 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold',
  '[&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold',
  '[&_h4]:mb-1.5 [&_h4]:mt-3 [&_h4]:text-sm [&_h4]:font-semibold',
  '[&_h5]:mb-1.5 [&_h5]:mt-3 [&_h5]:text-sm [&_h5]:font-medium',
  '[&_h6]:mb-1.5 [&_h6]:mt-3 [&_h6]:text-xs [&_h6]:font-medium',
  '[&_h6]:text-muted-foreground [&_hr]:my-4 [&_hr]:border-border',
  '[&_img]:my-4 [&_img]:block [&_img]:max-w-full [&_img]:rounded-lg',
  '[&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-lg',
  '[&_pre]:bg-muted/60 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_strong]:font-semibold [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse',
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
  '[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2',
  '[&_th]:py-1 [&_th]:text-left [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6',
  '[&_video]:my-4 [&_video]:block [&_video]:max-w-full [&_video]:rounded-lg [&_video]:bg-black/90'
)

const previewClassName = 'line-clamp-2 max-w-full overflow-hidden [&_*]:inline [&_br]:hidden'

function renderRichTextDoc(doc: RichTextNode) {
  return renderRichTextChildren(doc, 'doc')
}

function renderRichTextChildren(node: RichTextNode, key: string): ReactNode {
  if (!Array.isArray(node.content)) {
    return null
  }
  return node.content.map((child, index) => renderRichTextNode(child, `${key}-${index}`))
}

function renderRichTextNode(node: RichTextNode | null | undefined, key: string): ReactNode {
  if (!node || typeof node.type !== 'string') {
    return null
  }

  const children = renderRichTextChildren(node, key)
  switch (node.type) {
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>
    case 'bulletList':
      return <ul key={key}>{children}</ul>
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      )
    case 'doc':
      return <Fragment key={key}>{children}</Fragment>
    case 'hardBreak':
      return <br key={key} />
    case 'heading':
      return createElement(headingTag(node), { key }, children)
    case 'horizontalRule':
      return <hr key={key} />
    case 'listItem':
      return <li key={key}>{children}</li>
    case 'orderedList':
      return <ol key={key}>{children}</ol>
    case 'paragraph':
      return <p key={key}>{children}</p>
    case 'table':
      return <table key={key}>{children}</table>
    case 'tableCell':
      return <td key={key}>{children}</td>
    case 'tableHeader':
      return <th key={key}>{children}</th>
    case 'tableRow':
      return <tr key={key}>{children}</tr>
    case 'text':
      return renderRichTextText(node, key)
    case richTextMediaNodeNames.image:
      return renderRichTextImage(node, key)
    case richTextMediaNodeNames.video:
      return renderRichTextVideo(node, key)
    case richTextMediaNodeNames.audio:
      return renderRichTextAudio(node, key)
    default:
      return <Fragment key={key}>{children}</Fragment>
  }
}

function renderRichTextText(node: RichTextNode, key: string): ReactNode {
  const text = node.text || ''
  const content = <Fragment key={`${key}-text`}>{text}</Fragment>
  if (!Array.isArray(node.marks) || node.marks.length === 0) {
    return content
  }
  return node.marks.reduceRight<ReactNode>(
    (children, mark, index) => renderRichTextMark(mark, children, `${key}-mark-${index}`),
    content
  )
}

function renderRichTextMark(mark: RichTextMark | null | undefined, children: ReactNode, key: string) {
  if (!mark || typeof mark.type !== 'string') {
    return <Fragment key={key}>{children}</Fragment>
  }

  switch (mark.type) {
    case 'bold':
      return <strong key={key}>{children}</strong>
    case 'code':
      return <code key={key}>{children}</code>
    case 'italic':
      return <em key={key}>{children}</em>
    case 'link':
      return (
        <a key={key} href={safeHref(mark.attrs?.href)} target="_blank" rel="noreferrer">
          {children}
        </a>
      )
    case 'strike':
      return <s key={key}>{children}</s>
    case 'underline':
      return <u key={key}>{children}</u>
    default:
      return <Fragment key={key}>{children}</Fragment>
  }
}

function renderRichTextImage(node: RichTextNode, key: string) {
  const attrs = mediaAttrs(node)
  if (!attrs.src) {
    return null
  }
  return (
    <img
      key={key}
      src={attrs.src}
      alt={String(node.attrs?.alt || '')}
      title={String(node.attrs?.title || '')}
      style={attrs.style}
    />
  )
}

function renderRichTextVideo(node: RichTextNode, key: string) {
  const attrs = mediaAttrs(node)
  if (!attrs.src) {
    return null
  }
  return (
    <video
      key={key}
      src={attrs.src}
      controls
      preload="metadata"
      playsInline
      style={attrs.style}
    />
  )
}

function renderRichTextAudio(node: RichTextNode, key: string) {
  const attrs = mediaAttrs(node)
  if (!attrs.src) {
    return null
  }
  return <audio key={key} src={attrs.src} controls preload="none" style={attrs.style} />
}

function headingTag(node: RichTextNode) {
  const level = Number(node.attrs?.level || 2)
  const normalized = Number.isFinite(level) ? Math.min(Math.max(level, 1), 6) : 2
  return `h${normalized}`
}

function mediaAttrs(node: RichTextNode): {
  src: string
  style?: CSSProperties
} {
  const src = String(node.attrs?.src || '').trim()
  const maxWidth = normalizeRichTextMaxWidth(node.attrs?.maxWidth)
  return {
    src,
    style: maxWidth ? { maxWidth } : undefined,
  }
}

function safeHref(value: unknown) {
  const href = String(value || '').trim()
  if (/^(https?:|mailto:|\/)/i.test(href)) {
    return href
  }
  return '#'
}
