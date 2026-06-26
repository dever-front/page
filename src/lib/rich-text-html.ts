import {
  isEmptyRichTextDoc,
  normalizeRichTextMaxWidth,
  parseRichTextDoc,
  richTextExternalMediaNodeName,
  richTextMediaNodeNames,
  type RichTextMark,
  type RichTextNode,
} from './rich-text'
import { safeRichTextHref } from './rich-text-link'
import {
  richTextBlockStyleToCss,
  richTextLinkClassName,
  richTextStyleToCssText,
  richTextTextStyleToCss,
} from './rich-text-style'
import { cn } from './utils'

export type RichTextToHtmlOptions = {
  /**
   * 默认输出带富文本样式外层的完整 HTML。只要内部片段时传 false。
   */
  wrapper?: boolean
  preview?: boolean
  className?: string
}

export const richTextContentClassName = cn(
  'min-w-0 text-sm leading-6 text-foreground',
  richTextLinkClassName,
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

export const richTextPreviewClassName =
  'line-clamp-2 max-w-full overflow-hidden [&_*]:inline [&_br]:hidden'

export const richTextMediaCaptionClassName =
  'mt-2 whitespace-pre-line break-words px-1 text-center text-xs leading-5 text-muted-foreground'

export const richTextMediaCaptionStyleText =
  'margin-top: 0.5rem; white-space: pre-line; overflow-wrap: break-word; padding-left: 0.25rem; padding-right: 0.25rem; text-align: center; font-size: 0.75rem; line-height: 1.25rem; color: var(--muted-foreground, #64748b)'

const richTextExternalMediaClassName =
  'my-4 flex w-full max-w-full items-center gap-3 rounded-lg border bg-muted/25 p-3 no-underline transition hover:bg-muted/40'

export function richTextToHtml(value: unknown, options: RichTextToHtmlOptions = {}) {
  const doc = parseRichTextDoc(value)
  if (!doc || isEmptyRichTextDoc(doc)) {
    return ''
  }

  const html = renderRichTextChildren(doc)
  if (options.wrapper === false) {
    return html
  }

  return renderElement('div', {
    class: cn(
      richTextContentClassName,
      options.preview && richTextPreviewClassName,
      options.className
    ),
  }, html)
}

export function normalizeRichTextMediaCaption(value: unknown) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1000)
}

function renderRichTextChildren(node: RichTextNode | null | undefined) {
  if (!Array.isArray(node?.content)) {
    return ''
  }
  return node.content.map(renderRichTextNode).join('')
}

function renderRichTextNode(node: RichTextNode | null | undefined): string {
  if (!node || typeof node.type !== 'string') {
    return ''
  }

  const children = renderRichTextChildren(node)
  switch (node.type) {
    case 'blockquote':
      return renderElement('blockquote', {}, children)
    case 'bulletList':
      return renderElement('ul', {}, children)
    case 'codeBlock':
      return renderElement('pre', {}, renderElement('code', {}, children))
    case 'doc':
      return children
    case 'hardBreak':
      return '<br>'
    case 'heading':
      return renderElement(headingTag(node), { style: blockStyleText(node) }, children)
    case 'articleBlock':
      return renderElement('div', { style: blockStyleText(node) }, children)
    case 'horizontalRule':
      return '<hr>'
    case 'listItem':
      return renderElement('li', { style: blockStyleText(node) }, children)
    case 'orderedList':
      return renderElement('ol', {}, children)
    case 'paragraph':
      return renderElement('p', { style: blockStyleText(node) }, children)
    case 'agentAbilityPlaceholder':
    case 'agentTaskPlaceholder':
      return renderRichTextPlaceholder(node)
    case 'table':
      return renderElement('table', {}, children)
    case 'tableCell':
      return renderElement('td', { style: blockStyleText(node) }, children)
    case 'tableHeader':
      return renderElement('th', { style: blockStyleText(node) }, children)
    case 'tableRow':
      return renderElement('tr', {}, children)
    case 'text':
      return renderRichTextText(node)
    case richTextMediaNodeNames.image:
      return renderRichTextImage(node)
    case richTextMediaNodeNames.video:
      return renderRichTextVideo(node)
    case richTextMediaNodeNames.audio:
      return renderRichTextAudio(node)
    case richTextExternalMediaNodeName:
      return renderRichTextExternalMedia(node)
    default:
      return children
  }
}

function renderRichTextText(node: RichTextNode) {
  const text = escapeHtml(node.text || '')
  if (!Array.isArray(node.marks) || node.marks.length === 0) {
    return text
  }
  return node.marks.reduceRight(
    (children, mark) => renderRichTextMark(mark, children),
    text
  )
}

function renderRichTextMark(mark: RichTextMark | null | undefined, children: string) {
  if (!mark || typeof mark.type !== 'string') {
    return children
  }

  switch (mark.type) {
    case 'bold':
      return renderElement('strong', {}, children)
    case 'code':
      return renderElement('code', {}, children)
    case 'italic':
      return renderElement('em', {}, children)
    case 'link':
      return renderElement(
        'a',
        {
          href: safeRichTextHref(mark.attrs?.href),
          target: '_blank',
          rel: 'noreferrer',
        },
        children
      )
    case 'strike':
      return renderElement('s', {}, children)
    case 'textStyle':
      return renderTextStyleMark(mark, children)
    case 'underline':
      return renderElement('u', {}, children)
    default:
      return children
  }
}

function renderTextStyleMark(mark: RichTextMark, children: string) {
  const style = richTextTextStyleToCss(mark.attrs)
  const styleText = richTextStyleToCssText(style)
  return styleText ? renderElement('span', { style: styleText }, children) : children
}

function renderRichTextImage(node: RichTextNode) {
  const attrs = mediaAttrs(node)
  if (!attrs.src) {
    return ''
  }
  const caption = normalizeRichTextMediaCaption(node.attrs?.caption)
  if (caption) {
    return renderElement(
      'figure',
      { class: 'my-4 max-w-full', style: attrs.style },
      renderVoidElement('img', {
        src: attrs.src,
        alt: String(node.attrs?.alt || ''),
        title: String(node.attrs?.title || ''),
        style: 'margin: 0; max-width: 100%',
      }) + renderMediaCaption(caption)
    )
  }
  return renderVoidElement('img', {
    src: attrs.src,
    alt: String(node.attrs?.alt || ''),
    title: String(node.attrs?.title || ''),
    style: attrs.style,
  })
}

function renderRichTextVideo(node: RichTextNode) {
  const attrs = mediaAttrs(node)
  if (!attrs.src) {
    return ''
  }
  const caption = normalizeRichTextMediaCaption(node.attrs?.caption)
  const media = renderElement('video', {
    src: attrs.src,
    controls: true,
    preload: 'metadata',
    playsinline: true,
    style: caption ? 'margin: 0; max-width: 100%' : attrs.style,
  })
  return caption
    ? renderElement('figure', { class: 'my-4 max-w-full', style: attrs.style }, media + renderMediaCaption(caption))
    : media
}

function renderRichTextAudio(node: RichTextNode) {
  const attrs = mediaAttrs(node)
  if (!attrs.src) {
    return ''
  }
  const caption = normalizeRichTextMediaCaption(node.attrs?.caption)
  const media = renderElement('audio', {
    src: attrs.src,
    controls: true,
    preload: 'none',
    class: caption ? 'block w-full' : '',
    style: caption ? '' : attrs.style,
  })
  return caption
    ? renderElement('figure', { class: 'my-4 max-w-full', style: attrs.style }, media + renderMediaCaption(caption))
    : media
}

function renderRichTextExternalMedia(node: RichTextNode) {
  const src = String(node.attrs?.src || node.attrs?.href || '').trim()
  if (!src) {
    return ''
  }
  const kind = String(node.attrs?.kind || '').trim().toLowerCase() === 'audio' ? 'audio' : 'video'
  const title =
    String(node.attrs?.title || '').trim() || (kind === 'audio' ? '查看音频' : '查看视频')
  const cover = String(node.attrs?.cover || '').trim()
  const coverHTML = cover
    ? renderVoidElement('img', {
        src: cover,
        alt: '',
        class: 'm-0 h-14 w-20 shrink-0 rounded-md object-cover',
      })
    : renderElement(
        'span',
        {
          class:
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background text-xs font-medium text-muted-foreground',
        },
        kind === 'audio' ? '音频' : '视频'
      )
  const textHTML = renderElement(
    'span',
    { class: 'min-w-0 flex-1' },
    renderElement('span', { class: 'block truncate text-sm font-medium text-foreground' }, escapeHtml(title)) +
      renderElement('span', { class: 'mt-1 block truncate text-xs text-muted-foreground' }, escapeHtml(src))
  )
  return renderElement(
    'div',
    { style: mediaWrapperStyleText(node) },
    renderElement(
      'a',
      {
        href: safeRichTextHref(src),
        target: '_blank',
        rel: 'noreferrer',
        class: richTextExternalMediaClassName,
        style: mediaAttrs(node).style,
      },
      coverHTML + textHTML
    )
  )
}

function renderRichTextPlaceholder(node: RichTextNode) {
  const attrs = node.attrs || {}
  const status = String(attrs.status || 'pending')
  const title = String(attrs.title || attrs.kind || '素材生成').trim()
  const text = visiblePlaceholderText(attrs, status)
  const progress = normalizePlaceholderProgress(attrs.progress)
  const failed = status === 'failed'
  const succeeded = status === 'succeeded'
  const progressBar = progress != null
    ? renderElement('div', {
        class: cn(
          'h-full rounded-full transition-[width]',
          failed ? 'bg-destructive' : succeeded ? 'bg-emerald-500' : 'bg-primary'
        ),
        style: `width: ${progress}%`,
      })
    : renderElement('div', { class: 'h-full w-1/3 animate-pulse rounded-full bg-primary/75' })

  return renderElement(
    'div',
    {
      class: cn(
        'my-4 rounded-lg border bg-muted/25 px-3 py-2',
        failed && 'border-destructive/30 bg-destructive/10',
        succeeded && 'border-emerald-500/25 bg-emerald-500/10'
      ),
    },
    renderElement(
      'div',
      { class: 'mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground' },
      renderElement(
        'span',
        { class: 'truncate' },
        escapeHtml(title || '素材生成') + (text ? `：${escapeHtml(text)}` : '')
      ) +
        (progress != null
          ? renderElement('span', { class: 'shrink-0 tabular-nums' }, `${progress}%`)
          : '')
    ) + renderElement('div', { class: 'h-1.5 overflow-hidden rounded-full bg-muted' }, progressBar)
  )
}

function visiblePlaceholderText(attrs: Record<string, unknown>, status: string) {
  const error = String(attrs.error || '').trim()
  if (error) {
    return error
  }
  const text = String(attrs.text || '').trim()
  if (!text) {
    return ''
  }
  if ((status === 'pending' || status === 'running') && isDefaultPlaceholderStatusText(text)) {
    return ''
  }
  return text
}

function isDefaultPlaceholderStatusText(text: string) {
  return (
    /^(图片|图像|视频|音频|文件|附件|素材)生成中，请稍后。?$/.test(text) ||
    text === '正在调用能力'
  )
}

function renderMediaCaption(caption: string) {
  return renderElement(
    'figcaption',
    {
      class: richTextMediaCaptionClassName,
      style: richTextMediaCaptionStyleText,
    },
    escapeHtml(caption)
  )
}

function headingTag(node: RichTextNode) {
  const level = Number(node.attrs?.level || 2)
  const normalized = Number.isFinite(level) ? Math.min(Math.max(level, 1), 6) : 2
  return `h${normalized}`
}

function blockStyleText(node: RichTextNode) {
  return richTextStyleToCssText(richTextBlockStyleToCss(node.attrs || {}) || {})
}

function mediaAttrs(node: RichTextNode): { src: string; style: string } {
  const src = String(node.attrs?.src || '').trim()
  const maxWidth = normalizeRichTextMaxWidth(node.attrs?.maxWidth)
  const align = normalizeMediaAlign(node.attrs?.align)
  return {
    src,
    style: richTextStyleToCssText({
      ...(maxWidth ? { maxWidth } : {}),
      ...mediaAlignStyle(align),
    }),
  }
}

function mediaWrapperStyleText(node: RichTextNode) {
  const align = normalizeMediaAlign(node.attrs?.align)
  if (!align || align === 'left') {
    return ''
  }
  return richTextStyleToCssText({
    display: 'flex',
    justifyContent: align === 'center' ? 'center' : 'flex-end',
  })
}

function normalizeMediaAlign(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  return text === 'center' || text === 'right' ? text : 'left'
}

function mediaAlignStyle(align: string) {
  if (align === 'center') {
    return { marginLeft: 'auto', marginRight: 'auto' }
  }
  if (align === 'right') {
    return { marginLeft: 'auto' }
  }
  return {}
}

function normalizePlaceholderProgress(value: unknown) {
  const progress = Number(value)
  if (!Number.isFinite(progress)) {
    return null
  }
  return Math.max(0, Math.min(100, Math.round(progress)))
}

function renderElement(
  tag: string,
  attrs: Record<string, unknown> = {},
  children = ''
) {
  return `<${tag}${renderAttributes(attrs)}>${children}</${tag}>`
}

function renderVoidElement(tag: string, attrs: Record<string, unknown> = {}) {
  return `<${tag}${renderAttributes(attrs)}>`
}

function renderAttributes(attrs: Record<string, unknown>) {
  return Object.entries(attrs)
    .map(([key, value]) => renderAttribute(key, value))
    .filter(Boolean)
    .join('')
}

function renderAttribute(key: string, value: unknown) {
  if (value == null || value === false) {
    return ''
  }
  if (value === true) {
    return ` ${key}`
  }
  const text = String(value).trim()
  return text ? ` ${key}="${escapeAttribute(text)}"` : ''
}

function escapeHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttribute(value: unknown) {
  return escapeHtml(value).replace(/"/g, '&quot;')
}
