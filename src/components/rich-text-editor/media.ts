import { createElement } from 'react'
import type { NodeConfig } from '@tiptap/core'
import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import type { ResourceUploadRule } from '@/lib/resource'
import { resolveResourceKind } from '@/lib/resource'
import {
  defaultRichTextMediaMaxWidth,
  normalizeRichTextMaxWidth,
  richTextMediaNodeNames,
} from '@/lib/rich-text'
import type { UploadFileItem } from '@/lib/upload'
import { EditorMediaNodeView } from './media-node-view'

export type EditorMediaKind = 'image' | 'video' | 'audio'
export type EditorUploadRule = ResourceUploadRule & { kind: EditorMediaKind }

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
        },
        alt: {
          default: '',
        },
        title: {
          default: '',
        },
        maxWidth: createMediaMaxWidthAttribute(),
      }
    },
    parseHTML() {
      return [{ tag: 'img[src]' }]
    },
    renderHTML({ HTMLAttributes }) {
      return ['img', buildEditorMediaHTMLAttributes(HTMLAttributes)]
    },
    renderMarkdown(node: Record<string, any>) {
      const src = String(node.attrs?.src || '').trim()
      if (!src) {
        return ''
      }
      const alt = escapeMarkdownText(String(node.attrs?.alt || node.attrs?.title || '').trim())
      return `![${alt}](${src})`
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
        },
        maxWidth: createMediaMaxWidthAttribute(),
      }
    },
    parseHTML() {
      return [{ tag: 'video[src]' }]
    },
    renderHTML({ HTMLAttributes }) {
      return [
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
        },
        maxWidth: createMediaMaxWidthAttribute(),
      }
    },
    parseHTML() {
      return [{ tag: 'audio[src]' }]
    },
    renderHTML({ HTMLAttributes }) {
      return [
        'audio',
        buildEditorMediaHTMLAttributes(
          {
            controls: 'controls',
            preload: 'none',
          },
          HTMLAttributes
        ),
      ]
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
  const src = String(file.url || file.open_url || file.download || '').trim()
  if (!src) {
    return []
  }

  const name = String(file.name || '').trim()
  return [
    {
      type: resolveEditorMediaNodeName(kind),
      attrs:
        kind === 'image'
          ? {
              src,
              alt: name,
              title: name,
              maxWidth: defaultRichTextMediaMaxWidth(kind),
            }
          : {
              src,
              maxWidth: defaultRichTextMediaMaxWidth(kind),
            },
    },
    {
      type: 'paragraph',
    },
  ]
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
      normalizeRichTextMaxWidth(
        element.getAttribute('data-max-width') || element.style.maxWidth
      ),
  }
}

function buildEditorMediaHTMLAttributes(
  baseAttributes: Record<string, any>,
  htmlAttributes?: Record<string, any>
) {
  const mergedAttributes = mergeAttributes(baseAttributes, htmlAttributes)
  const normalizedMaxWidth = normalizeRichTextMaxWidth(mergedAttributes.maxWidth)
  const style = normalizeInlineStyle(mergedAttributes.style)
  const nextStyle = normalizedMaxWidth
    ? appendInlineStyle(style, `max-width:${normalizedMaxWidth}`)
    : style
  const { maxWidth, ...restAttributes } = mergedAttributes
  const nextAttributes = nextStyle
    ? mergeAttributes(restAttributes, { style: nextStyle })
    : restAttributes

  return normalizedMaxWidth
    ? mergeAttributes(nextAttributes, { 'data-max-width': normalizedMaxWidth })
    : nextAttributes
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
  return `[${label}](${src})`
}

function escapeMarkdownText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')
}
