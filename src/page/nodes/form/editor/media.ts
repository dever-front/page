import { createElement } from 'react'
import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import type { ResourceUploadRule } from '@/lib/resource'
import { resolveResourceKind } from '@/lib/resource'
import type { UploadFileItem } from '@/lib/upload'
import { EditorMediaNodeView } from './media-node-view'

export type EditorMediaKind = 'image' | 'video' | 'audio'
export type EditorUploadRule = ResourceUploadRule & { kind: EditorMediaKind }

const IMAGE_NODE_NAME = 'editorMediaImage'
const VIDEO_NODE_NAME = 'editorMediaVideo'
const AUDIO_NODE_NAME = 'editorMediaAudio'
const EDITOR_MEDIA_NODE_NAMES: Record<EditorMediaKind, string> = {
  image: IMAGE_NODE_NAME,
  video: VIDEO_NODE_NAME,
  audio: AUDIO_NODE_NAME,
}

export const editorMediaExtensions = [
  Node.create({
    name: IMAGE_NODE_NAME,
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
    addNodeView() {
      return ReactNodeViewRenderer((props) =>
        createElement(EditorMediaNodeView, {
          ...props,
          kind: 'image',
          label: '图片',
          defaultMaxWidth: resolveDefaultEditorMediaMaxWidth('image'),
        })
      )
    },
  }),
  Node.create({
    name: VIDEO_NODE_NAME,
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
    addNodeView() {
      return ReactNodeViewRenderer((props) =>
        createElement(EditorMediaNodeView, {
          ...props,
          kind: 'video',
          label: '视频',
          defaultMaxWidth: resolveDefaultEditorMediaMaxWidth('video'),
        })
      )
    },
  }),
  Node.create({
    name: AUDIO_NODE_NAME,
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
    addNodeView() {
      return ReactNodeViewRenderer((props) =>
        createElement(EditorMediaNodeView, {
          ...props,
          kind: 'audio',
          label: '音频',
          defaultMaxWidth: resolveDefaultEditorMediaMaxWidth('audio'),
        })
      )
    },
  }),
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
              maxWidth: resolveDefaultEditorMediaMaxWidth(kind),
            }
          : {
              src,
              maxWidth: resolveDefaultEditorMediaMaxWidth(kind),
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
      normalizeEditorMediaMaxWidthValue(
        element.getAttribute('data-max-width') || element.style.maxWidth
      ),
  }
}

function buildEditorMediaHTMLAttributes(
  baseAttributes: Record<string, any>,
  htmlAttributes?: Record<string, any>
) {
  const mergedAttributes = mergeAttributes(baseAttributes, htmlAttributes)
  const normalizedMaxWidth = normalizeEditorMediaMaxWidthValue(mergedAttributes.maxWidth)
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

function normalizeEditorMediaMaxWidthValue(value: unknown) {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) {
    return ''
  }

  if (/^\d+(\.\d+)?%$/.test(normalizedValue)) {
    return normalizedValue
  }

  if (/^\d+(\.\d+)?px$/.test(normalizedValue)) {
    return normalizedValue
  }

  return ''
}

function resolveDefaultEditorMediaMaxWidth(kind: EditorMediaKind) {
  switch (kind) {
    case 'image':
    case 'video':
      return '50%'
    case 'audio':
      return '384px'
  }
}
