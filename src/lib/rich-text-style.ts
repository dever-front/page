export type RichTextTextStyleAttrs = {
  color?: string | null
  backgroundColor?: string | null
  fontFamily?: string | null
  fontSize?: string | null
}

export const richTextFontFamilies = [
  { label: '系统', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { label: '宋体', value: 'SimSun, "Songti SC", serif' },
  { label: '黑体', value: 'SimHei, "Heiti SC", sans-serif' },
  { label: '等宽', value: '"SFMono-Regular", Consolas, "Liberation Mono", monospace' },
]

export const richTextFontSizes = [
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '24', value: '24px' },
  { label: '32', value: '32px' },
]

export const richTextTextColors = [
  '#111827',
  '#374151',
  '#dc2626',
  '#d97706',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
]

export const richTextHighlightColors = [
  '#fef3c7',
  '#fee2e2',
  '#dcfce7',
  '#dbeafe',
  '#ede9fe',
  '#f3f4f6',
]

export const richTextLinkClassName =
  '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/60 [&_a]:underline-offset-4 [&_a:hover]:decoration-primary'

const allowedTextColors = new Set(richTextTextColors)
const allowedHighlightColors = new Set(richTextHighlightColors)
const allowedFontFamilies = new Set(richTextFontFamilies.map((item) => item.value))
const allowedFontSizes = new Set(richTextFontSizes.map((item) => item.value))
const allowedTextAlignments = new Set(['left', 'center', 'right', 'justify'])
const hexColorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function normalizeRichTextTextStyleAttrs(
  value: RichTextTextStyleAttrs | Record<string, unknown> | null | undefined
): RichTextTextStyleAttrs {
  return {
    color: normalizeRichTextColor(value?.color, allowedTextColors),
    backgroundColor: normalizeRichTextColor(value?.backgroundColor, allowedHighlightColors),
    fontFamily: normalizeRichTextToken(value?.fontFamily, allowedFontFamilies),
    fontSize: normalizeRichTextToken(value?.fontSize, allowedFontSizes),
  }
}

export function richTextTextStyleToCss(
  value: RichTextTextStyleAttrs | Record<string, unknown> | null | undefined
) {
  const attrs = normalizeRichTextTextStyleAttrs(value)
  const style: Record<string, string> = {}
  if (attrs.color) {
    style.color = attrs.color
  }
  if (attrs.backgroundColor) {
    style.backgroundColor = attrs.backgroundColor
  }
  if (attrs.fontFamily) {
    style.fontFamily = attrs.fontFamily
  }
  if (attrs.fontSize) {
    style.fontSize = attrs.fontSize
  }
  return style
}

export function richTextStyleToCssText(style: Record<string, string>) {
  return Object.entries(style)
    .map(([key, value]) => `${toKebabCase(key)}: ${value}`)
    .join('; ')
}

export function normalizeRichTextTextAlign(value: unknown) {
  const text = String(value || '').trim()
  return allowedTextAlignments.has(text) ? text : ''
}

export function richTextTextAlignToCss(value: unknown) {
  const textAlign = normalizeRichTextTextAlign(value)
  return textAlign ? { textAlign } : undefined
}

export function normalizeRichTextHexColor(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  if (!hexColorPattern.test(text)) {
    return ''
  }
  return text.length === 4
    ? `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`
    : text
}

function normalizeRichTextColor(value: unknown, allowed: Set<string>) {
  const text = String(value || '').trim().toLowerCase()
  if (allowed.has(text)) {
    return text
  }
  return normalizeRichTextHexColor(text) || null
}

function normalizeRichTextToken(value: unknown, allowed: Set<string>) {
  const text = String(value || '').trim()
  return allowed.has(text) ? text : null
}

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
