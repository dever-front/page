import { createElement } from 'react'
import type { Editor, NodeConfig } from '@tiptap/core'
import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import type { ResourceUploadRule } from '@/lib/resource'
import { resolveResourceKind } from '@/lib/resource'
import {
  defaultRichTextMediaMaxWidth,
  richTextExternalMediaNodeName,
  normalizeRichTextMaxWidth,
  richTextMediaNodeNames,
} from '@/lib/rich-text'
import type { UploadFileItem } from '@/lib/upload'
import { EditorExternalMediaNodeView, EditorMediaNodeView } from './media-node-view'

export type EditorMediaKind = 'image' | 'video' | 'audio'
export type EditorUploadRule = ResourceUploadRule & { kind: EditorMediaKind }

export const DEFAULT_EDITOR_UPLOAD_RULES: EditorUploadRule[] = [
  {
    ruleId: 1,
    kind: 'image',
    accept: 'image/*',
    transport: 'relay',
  },
  {
    ruleId: 2,
    kind: 'video',
    accept: 'video/*',
    transport: 'relay',
  },
  {
    ruleId: 3,
    kind: 'audio',
    accept: 'audio/*',
    transport: 'relay',
  },
]

const EDITOR_MEDIA_NODE_NAMES: Record<EditorMediaKind, string> = {
  image: richTextMediaNodeNames.image,
  video: richTextMediaNodeNames.video,
  audio: richTextMediaNodeNames.audio,
}

type MarkdownNodeConfig = Partial<NodeConfig> & {
  renderMarkdown?: (node: Record<string, any>) => string
}

export const editorMediaExtensions = [
  Node.create({
    name: richTextMediaNodeNames.image,
    group: 'block',
    atom: true,
    isolating: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      return {
        src: {
          default: '',
          parseHTML: (element: HTMLElement) =>
            String(resolveMediaElement(element, 'image')?.getAttribute('src') || '').trim(),
        },
        alt: {
          default: '',
          parseHTML: (element: HTMLElement) =>
            String(resolveMediaElement(element, 'image')?.getAttribute('alt') || '').trim(),
        },
        title: {
          default: '',
          parseHTML: (element: HTMLElement) =>
            String(resolveMediaElement(element, 'image')?.getAttribute('title') || '').trim(),
        },
        caption: createMediaCaptionAttribute('image'),
        maxWidth: createMediaMaxWidthAttribute(),
        align: createMediaAlignAttribute(),
      }
    },
    parseHTML() {
      return [
        { tag: 'figure[data-rich-text-image]' },
        { tag: 'figure[data-rich-text-media][data-rich-text-kind="image"]' },
        { tag: 'img[src]' },
      ]
    },
    renderHTML({ HTMLAttributes }) {
      const caption = normalizeMediaCaption(HTMLAttributes.caption)
      const imageAttributes = buildEditorMediaHTMLAttributes(HTMLAttributes)
      if (!caption) {
        return ['img', imageAttributes]
      }
      return [
        'figure',
        buildEditorMediaFigureHTMLAttributes('image', HTMLAttributes, caption),
        ['img', mergeAttributes(imageAttributes, { 'data-caption': caption })],
        ['figcaption', caption],
      ]
    },
    renderMarkdown(node: Record<string, any>) {
      const src = String(node.attrs?.src || '').trim()
      if (!src) {
        return ''
      }
      const alt = escapeMarkdownText(String(node.attrs?.alt || node.attrs?.title || '').trim())
      const caption = normalizeMediaCaption(node.attrs?.caption)
      return caption ? `![${alt}](${src})\n\n_${escapeMarkdownText(caption)}_` : `![${alt}](${src})`
    },
    addNodeView() {
      return ReactNodeViewRenderer((props) =>
        createElement(EditorMediaNodeView, {
          ...props,
          kind: 'image',
          label: '图片',
          defaultMaxWidth: defaultRichTextMediaMaxWidth('image'),
        })
      )
    },
  } as MarkdownNodeConfig),
  Node.create({
    name: richTextMediaNodeNames.video,
    group: 'block',
    atom: true,
    isolating: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      return {
        src: {
          default: '',
          parseHTML: (element: HTMLElement) =>
            String(resolveMediaElement(element, 'video')?.getAttribute('src') || '').trim(),
        },
        maxWidth: createMediaMaxWidthAttribute(),
        align: createMediaAlignAttribute(),
        caption: createMediaCaptionAttribute('video'),
      }
    },
    parseHTML() {
      return [
        { tag: 'figure[data-rich-text-media][data-rich-text-kind="video"]' },
        { tag: 'video[src]' },
      ]
    },
    renderHTML({ HTMLAttributes }) {
      const mediaHTML = [
        'video',
        buildEditorMediaHTMLAttributes(
          {
            controls: 'controls',
            preload: 'metadata',
            playsinline: 'playsinline',
          },
          HTMLAttributes
        ),
      ]
      return renderCaptionedMediaHTML('video', HTMLAttributes, mediaHTML)
    },
    renderMarkdown(node: Record<string, any>) {
      return renderMediaMarkdownLink(node, '视频')
    },
    addNodeView() {
      return ReactNodeViewRenderer((props) =>
        createElement(EditorMediaNodeView, {
          ...props,
          kind: 'video',
          label: '视频',
          defaultMaxWidth: defaultRichTextMediaMaxWidth('video'),
        })
      )
    },
  } as MarkdownNodeConfig),
  Node.create({
    name: richTextMediaNodeNames.audio,
    group: 'block',
    atom: true,
    isolating: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      return {
        src: {
          default: '',
          parseHTML: (element: HTMLElement) =>
            String(resolveMediaElement(element, 'audio')?.getAttribute('src') || '').trim(),
        },
        maxWidth: createMediaMaxWidthAttribute(),
        align: createMediaAlignAttribute(),
        caption: createMediaCaptionAttribute('audio'),
      }
    },
    parseHTML() {
      return [
        { tag: 'figure[data-rich-text-media][data-rich-text-kind="audio"]' },
        { tag: 'audio[src]' },
      ]
    },
    renderHTML({ HTMLAttributes }) {
      const mediaHTML = [
        'audio',
        buildEditorMediaHTMLAttributes(
          {
            controls: 'controls',
            preload: 'none',
          },
          HTMLAttributes
        ),
      ]
      return renderCaptionedMediaHTML('audio', HTMLAttributes, mediaHTML)
    },
    renderMarkdown(node: Record<string, any>) {
      return renderMediaMarkdownLink(node, '音频')
    },
    addNodeView() {
      return ReactNodeViewRenderer((props) =>
        createElement(EditorMediaNodeView, {
          ...props,
          kind: 'audio',
          label: '音频',
          defaultMaxWidth: defaultRichTextMediaMaxWidth('audio'),
        })
      )
    },
  } as MarkdownNodeConfig),
  Node.create({
    name: richTextExternalMediaNodeName,
    group: 'block',
    atom: true,
    isolating: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      return {
        kind: {
          default: 'video',
          parseHTML: (element: HTMLElement) =>
            normalizeExternalMediaKind(element.getAttribute('data-rich-media-kind')),
        },
        src: {
          default: '',
          parseHTML: (element: HTMLElement) =>
            normalizeExternalMediaSource(
              element.getAttribute('data-rich-media-src') ||
                element.querySelector('a[href]')?.getAttribute('href') ||
                ''
            ),
        },
        title: {
          default: '',
          parseHTML: (element: HTMLElement) =>
            String(
              element.getAttribute('data-rich-media-title') ||
                element.querySelector('a[href]')?.textContent ||
                ''
            ).trim(),
        },
        cover: {
          default: '',
          parseHTML: (element: HTMLElement) =>
            String(element.getAttribute('data-rich-media-cover') || '').trim(),
        },
        maxWidth: createMediaMaxWidthAttribute(),
        align: createMediaAlignAttribute(),
      }
    },
    parseHTML() {
      return [{ tag: 'div[data-rich-media-embed]' }]
    },
    renderHTML({ HTMLAttributes }) {
      const attrs = buildExternalMediaHTMLAttributes(HTMLAttributes)
      return [
        'div',
        attrs,
        [
          'a',
          {
            href: attrs['data-rich-media-src'],
            target: '_blank',
            rel: 'noreferrer',
          },
          attrs['data-rich-media-title'] || resolveExternalMediaLabel(attrs['data-rich-media-kind']),
        ],
      ]
    },
    renderMarkdown(node: Record<string, any>) {
      const src = String(node.attrs?.src || '').trim()
      if (!src) {
        return ''
      }
      const label = escapeMarkdownText(
        String(node.attrs?.title || resolveExternalMediaLabel(node.attrs?.kind)).trim()
      )
      return `[${label}](${src})`
    },
    addNodeView() {
      return ReactNodeViewRenderer((props) =>
        createElement(EditorExternalMediaNodeView, {
          ...props,
        })
      )
    },
  } as MarkdownNodeConfig),
]

export function normalizeEditorUploadRules(rules: ResourceUploadRule[]) {
  const result: EditorUploadRule[] = []
  const seenKinds = new Set<EditorMediaKind>()

  for (const current of Array.isArray(rules) ? rules : []) {
    const kind = resolveEditorMediaKind(current)
    if (!kind || seenKinds.has(kind)) {
      continue
    }

    seenKinds.add(kind)
    result.push({
      ...current,
      kind,
    })
  }

  return result
}

export function withDefaultEditorUploadRules(rules: ResourceUploadRule[]) {
  const normalizedRules = normalizeEditorUploadRules(rules)
  const seenKinds = new Set(normalizedRules.map((current) => current.kind))
  const missingDefaults = DEFAULT_EDITOR_UPLOAD_RULES.filter(
    (current) => !seenKinds.has(current.kind)
  )
  return [...normalizedRules, ...missingDefaults]
}

export function resolveEditorUploadLabel(kind: EditorMediaKind) {
  switch (kind) {
    case 'image':
      return '上传图片'
    case 'video':
      return '上传视频'
    case 'audio':
      return '上传音频'
  }
}

export function resolveEditorMediaLabel(kind: EditorMediaKind) {
  switch (kind) {
    case 'image':
      return '图片'
    case 'video':
      return '视频'
    case 'audio':
      return '音频'
  }
}

export function buildEditorMediaInsertContent(
  file: UploadFileItem,
  kind: EditorMediaKind
) {
  const src = resolveEditorMediaFileSource(file)
  if (!src) {
    return []
  }

  return [
    {
      type: resolveEditorMediaNodeName(kind),
      attrs: buildEditorMediaAttrs(file, kind),
    },
    {
      type: 'paragraph',
    },
  ]
}

export function replaceEditorMediaSource(
  editor: Editor,
  kind: EditorMediaKind,
  sourceUrl: string,
  file: UploadFileItem
) {
  const nextSrc = resolveEditorMediaFileSource(file)
  if (!nextSrc || !sourceUrl) {
    return false
  }

  const mediaNodeName = resolveEditorMediaNodeName(kind)
  const nextAttrs = buildEditorMediaAttrs(file, kind)
  let transaction = editor.state.tr
  let changed = false

  editor.state.doc.descendants((node, position) => {
    if (
      node.type.name !== mediaNodeName ||
      String(node.attrs.src || '').trim() !== sourceUrl
    ) {
      return
    }

    transaction = transaction.setNodeMarkup(position, undefined, {
      ...node.attrs,
      ...nextAttrs,
      maxWidth: node.attrs.maxWidth || nextAttrs.maxWidth,
    })
    changed = true
  })

  if (changed) {
    editor.view.dispatch(transaction)
  }

  return changed
}

export function resolveEditorMediaFileSource(file: UploadFileItem) {
  return String(file.url || file.open_url || file.download || '').trim()
}

function buildEditorMediaAttrs(file: UploadFileItem, kind: EditorMediaKind) {
  const src = resolveEditorMediaFileSource(file)
  const name = String(file.name || '').trim()

  return kind === 'image'
    ? {
        src,
        alt: name,
        title: name,
        maxWidth: defaultRichTextMediaMaxWidth(kind),
        align: '',
      }
    : {
        src,
        maxWidth: defaultRichTextMediaMaxWidth(kind),
        align: '',
      }
}

function resolveEditorMediaKind(rule: ResourceUploadRule) {
  const kind = resolveResourceKind({
    kind: rule.kind,
    accept: rule.accept,
  })

  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    return kind
  }

  return ''
}

export function resolveEditorMediaNodeName(kind: EditorMediaKind) {
  return EDITOR_MEDIA_NODE_NAMES[kind]
}

function createMediaMaxWidthAttribute() {
  return {
    default: '',
    parseHTML: (element: HTMLElement) =>
      firstNormalizedMediaMaxWidth(
        element.getAttribute('data-max-width'),
        element.style.maxWidth,
        element.style.width,
        element.getAttribute('width'),
        element.getAttribute('data-w')
      ),
  }
}

function createMediaAlignAttribute() {
  return {
    default: '',
    parseHTML: (element: HTMLElement) =>
      normalizeMediaAlign(element.getAttribute('data-align') || element.style.textAlign),
  }
}

function createMediaCaptionAttribute(kind: EditorMediaKind) {
  return {
    default: '',
    parseHTML: (element: HTMLElement) =>
      normalizeMediaCaption(
        element.getAttribute('data-caption') ||
          resolveMediaElement(element, kind)?.getAttribute('data-caption') ||
          element.querySelector('figcaption')?.textContent ||
          ''
      ),
  }
}

function buildEditorMediaHTMLAttributes(
  baseAttributes: Record<string, any>,
  htmlAttributes?: Record<string, any>
) {
  const mergedAttributes = mergeAttributes(baseAttributes, htmlAttributes)
  const normalizedMaxWidth = normalizeRichTextMaxWidth(mergedAttributes.maxWidth)
  const align = normalizeMediaAlign(mergedAttributes.align)
  const style = normalizeInlineStyle(mergedAttributes.style)
  const nextStyle = [
    normalizedMaxWidth ? `max-width:${normalizedMaxWidth}` : '',
    align ? `text-align:${align}` : '',
  ].filter(Boolean).reduce(appendInlineStyle, style)
  const restAttributes = { ...mergedAttributes }
  delete restAttributes.maxWidth
  delete restAttributes.align
  delete restAttributes.caption
  const nextAttributes = nextStyle
    ? mergeAttributes(restAttributes, { style: nextStyle })
    : restAttributes

  return mergeAttributes(
    nextAttributes,
    normalizedMaxWidth ? { 'data-max-width': normalizedMaxWidth } : {},
    align ? { 'data-align': align } : {}
  )
}

function renderCaptionedMediaHTML(
  kind: EditorMediaKind,
  htmlAttributes: Record<string, any>,
  mediaHTML: any[]
) {
  const caption = normalizeMediaCaption(htmlAttributes.caption)
  if (!caption) {
    return mediaHTML
  }
  return [
    'figure',
    buildEditorMediaFigureHTMLAttributes(kind, htmlAttributes, caption),
    mediaHTML,
    ['figcaption', caption],
  ]
}

function buildEditorMediaFigureHTMLAttributes(
  kind: EditorMediaKind,
  htmlAttributes: Record<string, any>,
  caption: string
) {
  return mergeAttributes(
    kind === 'image' ? { 'data-rich-text-image': 'true' } : {},
    {
      'data-rich-text-media': 'true',
      'data-rich-text-kind': kind,
      'data-caption': caption,
    },
    buildMediaContainerHTMLAttributes(htmlAttributes)
  )
}

function buildExternalMediaHTMLAttributes(htmlAttributes?: Record<string, any>) {
  const kind = normalizeExternalMediaKind(htmlAttributes?.kind)
  const src = normalizeExternalMediaSource(htmlAttributes?.src)
  const title =
    String(htmlAttributes?.title || '').trim() || resolveExternalMediaLabel(kind)
  const cover = String(htmlAttributes?.cover || '').trim()
  const normalizedMaxWidth = normalizeRichTextMaxWidth(htmlAttributes?.maxWidth)
  const align = normalizeMediaAlign(htmlAttributes?.align)
  return mergeAttributes(
    {
      'data-rich-media-embed': 'true',
      'data-rich-media-kind': kind,
      'data-rich-media-src': src,
      'data-rich-media-title': title,
    },
    cover ? { 'data-rich-media-cover': cover } : {},
    normalizedMaxWidth ? { 'data-max-width': normalizedMaxWidth } : {},
    align ? { 'data-align': align } : {}
  )
}

function buildMediaContainerHTMLAttributes(htmlAttributes?: Record<string, any>) {
  const normalizedMaxWidth = normalizeRichTextMaxWidth(htmlAttributes?.maxWidth)
  const align = normalizeMediaAlign(htmlAttributes?.align)
  const styles = [
    normalizedMaxWidth ? `max-width:${normalizedMaxWidth}` : '',
    align === 'center' ? 'margin-left:auto' : '',
    align === 'center' ? 'margin-right:auto' : '',
    align === 'right' ? 'margin-left:auto' : '',
    align ? `text-align:${align}` : '',
  ]
    .filter(Boolean)
    .join('; ')
  return styles ? { style: styles } : {}
}

function appendInlineStyle(style: string, declaration: string) {
  return style ? `${style}; ${declaration}` : declaration
}

function normalizeInlineStyle(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/;+\s*$/, '')
}

function renderMediaMarkdownLink(node: Record<string, any>, label: string) {
  const src = String(node.attrs?.src || '').trim()
  if (!src) {
    return ''
  }
  const caption = normalizeMediaCaption(node.attrs?.caption)
  const link = `[${label}](${src})`
  return caption ? `${link}\n\n_${escapeMarkdownText(caption)}_` : link
}

function normalizeMediaAlign(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  return ['left', 'center', 'right'].includes(text) ? text : ''
}

function firstNormalizedMediaMaxWidth(...values: unknown[]) {
  for (const value of values) {
    const normalized =
      normalizeRichTextMaxWidth(value) ||
      normalizeRichTextMaxWidth(normalizeNumericWidth(value))
    if (normalized) {
      return normalized
    }
  }
  return ''
}

function normalizeNumericWidth(value: unknown) {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }
  const number = Number(text)
  return Number.isFinite(number) && number > 0 ? `${number}px` : ''
}

function normalizeExternalMediaKind(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  return text === 'audio' ? 'audio' : 'video'
}

function resolveExternalMediaLabel(value: unknown) {
  return normalizeExternalMediaKind(value) === 'audio' ? '查看音频' : '查看视频'
}

function normalizeExternalMediaSource(value: unknown) {
  const text = String(value || '').trim()
  return /^https?:\/\//i.test(text) ? text : ''
}

function resolveMediaElement(element: HTMLElement, kind: EditorMediaKind) {
  const tagName = kind === 'image' ? 'img' : kind
  if (element.tagName.toLowerCase() === tagName) {
    return element
  }
  return element.querySelector(`${tagName}[src]`) as HTMLElement | null
}

function normalizeMediaCaption(value: unknown) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1000)
}

function escapeMarkdownText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')
}
