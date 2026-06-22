import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core'
import {
  richTextBlockStyleKeys,
  normalizeRichTextBlockStyleAttrs,
  normalizeRichTextTextAlign,
  normalizeRichTextTextStyleAttrs,
  richTextBlockStyleToCss,
  richTextStyleToCssText,
  richTextTextStyleToCss,
  type RichTextBlockStyleKey,
  type RichTextTextStyleAttrs,
} from '@/lib/rich-text-style'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    richTextStyle: {
      setRichTextStyle: (attrs: RichTextTextStyleAttrs) => ReturnType
      clearRichTextStyle: () => ReturnType
      setRichTextAlign: (align: string) => ReturnType
      clearRichTextAlign: () => ReturnType
    }
  }
}

export const RichTextStyleMark = Mark.create({
  name: 'textStyle',

  addAttributes() {
    return {
      color: {
        default: null,
        rendered: false,
        parseHTML: (element) =>
          normalizeRichTextTextStyleAttrs({ color: element.style.color }).color,
      },
      backgroundColor: {
        default: null,
        rendered: false,
        parseHTML: (element) =>
          normalizeRichTextTextStyleAttrs({ backgroundColor: element.style.backgroundColor })
            .backgroundColor,
      },
      fontFamily: {
        default: null,
        rendered: false,
        parseHTML: (element) =>
          normalizeRichTextTextStyleAttrs({ fontFamily: element.style.fontFamily }).fontFamily,
      },
      fontSize: {
        default: null,
        rendered: false,
        parseHTML: (element) =>
          normalizeRichTextTextStyleAttrs({ fontSize: element.style.fontSize }).fontSize,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[style]' }]
  },

  renderHTML({ mark }) {
    const style = richTextTextStyleToCss(mark.attrs)
    const styleText = richTextStyleToCssText(style)
    return ['span', mergeAttributes(styleText ? { style: styleText } : {}), 0]
  },

  addCommands() {
    return {
      setRichTextStyle:
        (attrs) =>
        ({ commands }) => {
          const normalized = normalizeProvidedRichTextStyleAttrs(attrs)
          return commands.setMark(this.name, normalized)
        },
      clearRichTextStyle:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})

const richTextStyleKeys = ['color', 'backgroundColor', 'fontFamily', 'fontSize'] as const

function normalizeProvidedRichTextStyleAttrs(attrs: RichTextTextStyleAttrs) {
  const normalized = normalizeRichTextTextStyleAttrs(attrs)
  const result: RichTextTextStyleAttrs = {}
  for (const key of richTextStyleKeys) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) {
      result[key] = normalized[key]
    }
  }
  return result
}

const richTextBlockNodeTypes = [
  'heading',
  'paragraph',
  'blockquote',
  'listItem',
  'tableCell',
  'tableHeader',
] as const

export const RichTextTextAlign = Extension.create({
  name: 'richTextTextAlign',

  addGlobalAttributes() {
    return [
      {
        types: [...richTextBlockNodeTypes],
        attributes: buildRichTextBlockStyleAttributes(),
      },
    ]
  },

  addCommands() {
    return {
      setRichTextAlign:
        (align) =>
        ({ commands }) => {
          const textAlign = normalizeRichTextTextAlign(align)
          if (!textAlign) {
            return commands.clearRichTextAlign()
          }

          return updateBlockAttributes(commands, { textAlign })
        },
      clearRichTextAlign:
        () =>
        ({ commands }) =>
          updateBlockAttributes(commands, { textAlign: null }),
    }
  },
})

export const RichTextArticleBlock = Node.create({
  name: 'articleBlock',
  group: 'block',
  content: 'block*',

  addAttributes() {
    return buildRichTextBlockStyleAttributes()
  },

  parseHTML() {
    return [
      { tag: 'div[data-rich-text-block]' },
      { tag: 'section[data-rich-text-block]' },
      { tag: 'article[data-rich-text-block]' },
      { tag: 'main[data-rich-text-block]' },
      { tag: 'aside[data-rich-text-block]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-rich-text-block': 'true' }, HTMLAttributes), 0]
  },
})

const blockStyleHTMLParsers: Record<RichTextBlockStyleKey, (element: HTMLElement) => unknown> = {
  textAlign: (element) => element.style.textAlign || element.getAttribute('align'),
  lineHeight: (element) => element.style.lineHeight,
  color: (element) => element.style.color || element.getAttribute('color'),
  backgroundColor: (element) => element.style.backgroundColor || element.getAttribute('bgcolor'),
  fontFamily: (element) => element.style.fontFamily,
  fontSize: (element) => element.style.fontSize,
  textIndent: (element) => element.style.textIndent,
  marginTop: (element) => element.style.marginTop,
  marginRight: (element) => element.style.marginRight,
  marginBottom: (element) => element.style.marginBottom,
  marginLeft: (element) => element.style.marginLeft,
  paddingTop: (element) => element.style.paddingTop,
  paddingRight: (element) => element.style.paddingRight,
  paddingBottom: (element) => element.style.paddingBottom,
  paddingLeft: (element) => element.style.paddingLeft,
  border: (element) => element.style.border,
  borderTop: (element) => element.style.borderTop,
  borderRight: (element) => element.style.borderRight,
  borderBottom: (element) => element.style.borderBottom,
  borderLeft: (element) => element.style.borderLeft,
  borderRadius: (element) => element.style.borderRadius,
  width: (element) => element.style.width,
  maxWidth: (element) => element.style.maxWidth,
}

function buildRichTextBlockStyleAttributes() {
  return Object.fromEntries(
    richTextBlockStyleKeys.map((key) => [
      key,
      {
        default: null,
        parseHTML: (element: HTMLElement) =>
          normalizeRichTextBlockStyleAttrs({
            [key]: blockStyleHTMLParsers[key](element),
          })[key] || null,
        renderHTML: (attributes: Record<string, unknown>) =>
          renderBlockStyleHTML(key, attributes[key]),
      },
    ])
  )
}

function renderBlockStyleHTML(key: RichTextBlockStyleKey, value: unknown) {
  const style = richTextBlockStyleToCss({ [key]: value })
  const styleText = richTextStyleToCssText(style || {})
  return styleText ? { style: styleText } : {}
}

function updateBlockAttributes(commands: {
  updateAttributes: (type: string, attrs: Record<string, unknown>) => boolean
}, attrs: Record<string, unknown>) {
  let updated = false
  for (const type of richTextBlockNodeTypes) {
    updated = commands.updateAttributes(type, attrs) || updated
  }
  return updated
}
