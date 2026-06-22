import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import {
  normalizeRichTextLineHeight,
  normalizeRichTextTextAlign,
  normalizeRichTextTextStyleAttrs,
  richTextStyleToCssText,
  richTextTextStyleToCss,
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

export const RichTextTextAlign = Extension.create({
  name: 'richTextTextAlign',

  addGlobalAttributes() {
    return [
      {
        types: ['heading', 'paragraph', 'tableCell', 'tableHeader'],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => normalizeRichTextTextAlign(element.style.textAlign) || null,
            renderHTML: (attributes) => renderBlockStyleHTML(attributes),
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => normalizeRichTextLineHeight(element.style.lineHeight) || null,
            rendered: false,
          },
        },
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

function renderBlockStyleHTML(attributes: Record<string, unknown>) {
  const textAlign = normalizeRichTextTextAlign(attributes.textAlign)
  const lineHeight = normalizeRichTextLineHeight(attributes.lineHeight)
  const styles: string[] = []
  if (textAlign) {
    styles.push(`text-align: ${textAlign}`)
  }
  if (lineHeight) {
    styles.push(`line-height: ${lineHeight}`)
  }
  return styles.length > 0 ? { style: styles.join('; ') } : {}
}

function updateBlockAttributes(commands: {
  updateAttributes: (type: string, attrs: Record<string, unknown>) => boolean
}, attrs: Record<string, unknown>) {
  let updated = false
  for (const type of ['paragraph', 'heading', 'tableCell', 'tableHeader']) {
    updated = commands.updateAttributes(type, attrs) || updated
  }
  return updated
}
