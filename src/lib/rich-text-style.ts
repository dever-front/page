export type RichTextTextStyleAttrs = {
  color?: string | null
  backgroundColor?: string | null
  fontFamily?: string | null
  fontSize?: string | null
}

export type RichTextBlockStyleAttrs = RichTextTextStyleAttrs & {
  textAlign?: string | null
  lineHeight?: string | null
  textIndent?: string | null
  marginTop?: string | null
  marginRight?: string | null
  marginBottom?: string | null
  marginLeft?: string | null
  paddingTop?: string | null
  paddingRight?: string | null
  paddingBottom?: string | null
  paddingLeft?: string | null
  border?: string | null
  borderTop?: string | null
  borderRight?: string | null
  borderBottom?: string | null
  borderLeft?: string | null
  borderRadius?: string | null
  width?: string | null
  maxWidth?: string | null
}

export const richTextBlockStyleKeys = [
  'textAlign',
  'lineHeight',
  'color',
  'backgroundColor',
  'fontFamily',
  'fontSize',
  'textIndent',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'border',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',
  'borderRadius',
  'width',
  'maxWidth',
] as const

export type RichTextBlockStyleKey = (typeof richTextBlockStyleKeys)[number]

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
const rgbColorPattern = /^rgba?\(([^)]+)\)$/i
const cssLineHeightPattern = /^(\d+(?:\.\d+)?)(px|em|rem|%)?$/i
const cssLengthPattern = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)$/i

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

export function normalizeRichTextBlockStyleAttrs(
  value: RichTextBlockStyleAttrs | Record<string, unknown> | null | undefined
): RichTextBlockStyleAttrs {
  return {
    textAlign: normalizeRichTextTextAlign(value?.textAlign) || null,
    lineHeight: normalizeRichTextLineHeight(value?.lineHeight) || null,
    color: normalizeRichTextColor(value?.color, allowedTextColors),
    backgroundColor: normalizeRichTextColor(value?.backgroundColor, allowedHighlightColors),
    fontFamily: normalizeRichTextToken(value?.fontFamily, allowedFontFamilies),
    fontSize: normalizeRichTextToken(value?.fontSize, allowedFontSizes),
    textIndent: normalizeRichTextSpacing(value?.textIndent, { maxPx: 160, allowNegative: true }),
    marginTop: normalizeRichTextSpacing(value?.marginTop, { maxPx: 240, allowAuto: true }),
    marginRight: normalizeRichTextSpacing(value?.marginRight, { maxPx: 240, allowAuto: true }),
    marginBottom: normalizeRichTextSpacing(value?.marginBottom, { maxPx: 240, allowAuto: true }),
    marginLeft: normalizeRichTextSpacing(value?.marginLeft, { maxPx: 240, allowAuto: true }),
    paddingTop: normalizeRichTextSpacing(value?.paddingTop, { maxPx: 240 }),
    paddingRight: normalizeRichTextSpacing(value?.paddingRight, { maxPx: 240 }),
    paddingBottom: normalizeRichTextSpacing(value?.paddingBottom, { maxPx: 240 }),
    paddingLeft: normalizeRichTextSpacing(value?.paddingLeft, { maxPx: 240 }),
    border: normalizeRichTextBorder(value?.border),
    borderTop: normalizeRichTextBorder(value?.borderTop),
    borderRight: normalizeRichTextBorder(value?.borderRight),
    borderBottom: normalizeRichTextBorder(value?.borderBottom),
    borderLeft: normalizeRichTextBorder(value?.borderLeft),
    borderRadius: normalizeRichTextRadius(value?.borderRadius),
    width: normalizeRichTextSize(value?.width),
    maxWidth: normalizeRichTextSize(value?.maxWidth),
  }
}

export function normalizeRichTextLineHeight(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) {
    return ''
  }
  if (text === 'normal') {
    return text
  }

  const match = text.match(cssLineHeightPattern)
  if (!match) {
    return ''
  }

  const number = Number(match[1])
  const unit = match[2] || ''
  if (!Number.isFinite(number) || number <= 0) {
    return ''
  }

  if (!unit) {
    return number >= 1 && number <= 3 ? String(number) : ''
  }
  if (unit === '%' && number >= 80 && number <= 300) {
    return `${number}%`
  }
  if ((unit === 'em' || unit === 'rem') && number >= 0.8 && number <= 3) {
    return `${number}${unit}`
  }
  if (unit === 'px' && number >= 12 && number <= 96) {
    return `${number}px`
  }
  return ''
}

export function richTextBlockStyleToCss(value: Record<string, unknown> | null | undefined) {
  const style: Record<string, string> = {}
  const attrs = normalizeRichTextBlockStyleAttrs(value)
  appendStyleValue(style, 'textAlign', attrs.textAlign)
  appendStyleValue(style, 'lineHeight', attrs.lineHeight)
  appendStyleValue(style, 'color', attrs.color)
  appendStyleValue(style, 'backgroundColor', attrs.backgroundColor)
  appendStyleValue(style, 'fontFamily', attrs.fontFamily)
  appendStyleValue(style, 'fontSize', attrs.fontSize)
  appendStyleValue(style, 'textIndent', attrs.textIndent)
  appendStyleValue(style, 'marginTop', attrs.marginTop)
  appendStyleValue(style, 'marginRight', attrs.marginRight)
  appendStyleValue(style, 'marginBottom', attrs.marginBottom)
  appendStyleValue(style, 'marginLeft', attrs.marginLeft)
  appendStyleValue(style, 'paddingTop', attrs.paddingTop)
  appendStyleValue(style, 'paddingRight', attrs.paddingRight)
  appendStyleValue(style, 'paddingBottom', attrs.paddingBottom)
  appendStyleValue(style, 'paddingLeft', attrs.paddingLeft)
  appendStyleValue(style, 'border', attrs.border)
  appendStyleValue(style, 'borderTop', attrs.borderTop)
  appendStyleValue(style, 'borderRight', attrs.borderRight)
  appendStyleValue(style, 'borderBottom', attrs.borderBottom)
  appendStyleValue(style, 'borderLeft', attrs.borderLeft)
  appendStyleValue(style, 'borderRadius', attrs.borderRadius)
  appendStyleValue(style, 'width', attrs.width)
  appendStyleValue(style, 'maxWidth', attrs.maxWidth)
  return Object.keys(style).length > 0 ? style : undefined
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
  return normalizeRichTextHexColor(text) || normalizeRGBColor(text) || null
}

function normalizeRichTextToken(value: unknown, allowed: Set<string>) {
  const text = String(value || '').trim()
  if (allowed.has(text)) {
    return text
  }
  return normalizeCSSFontSize(text) || null
}

function appendStyleValue(style: Record<string, string>, key: string, value: unknown) {
  const text = String(value || '').trim()
  if (text) {
    style[key] = text
  }
}

function normalizeRGBColor(value: string) {
  const match = value.match(rgbColorPattern)
  if (!match) {
    return ''
  }
  const parts = match[1].split(',').map((part) => part.trim())
  if (parts.length < 3) {
    return ''
  }
  const channels = parts.slice(0, 3).map(parseRGBChannel)
  const normalizedChannels = channels.filter((channel): channel is number => channel != null)
  if (normalizedChannels.length !== 3) {
    return ''
  }
  const alpha = parts.length > 3 ? parseCSSAlpha(parts[3]) : 1
  if (alpha == null || alpha <= 0) {
    return ''
  }
  return `#${normalizedChannels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function parseRGBChannel(value: string) {
  const percent = value.endsWith('%')
  const number = Number(percent ? value.slice(0, -1) : value)
  if (!Number.isFinite(number)) {
    return null
  }
  const channel = percent ? Math.round((number / 100) * 255) : Math.round(number)
  return channel >= 0 && channel <= 255 ? channel : null
}

function parseCSSAlpha(value: string) {
  const percent = value.endsWith('%')
  const number = Number(percent ? value.slice(0, -1) : value)
  if (!Number.isFinite(number)) {
    return null
  }
  const alpha = percent ? number / 100 : number
  return alpha >= 0 && alpha <= 1 ? alpha : null
}

function normalizeCSSFontSize(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?)px$/)
  if (!match) {
    return ''
  }
  const size = Number(match[1])
  if (!Number.isFinite(size) || size < 10 || size > 48) {
    return ''
  }
  return `${size}px`
}

function normalizeRichTextSpacing(
  value: unknown,
  options: { maxPx: number; allowNegative?: boolean; allowAuto?: boolean }
) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) {
    return null
  }
  if (options.allowAuto && text === 'auto') {
    return text
  }
  return normalizeRichTextLength(text, {
    minPx: options.allowNegative ? -options.maxPx : 0,
    maxPx: options.maxPx,
    maxPercent: 100,
  })
}

function normalizeRichTextRadius(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) {
    return null
  }
  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length < 1 || parts.length > 4) {
    return null
  }
  const normalized = parts.map((part) =>
    normalizeRichTextLength(part, { minPx: 0, maxPx: 160, maxPercent: 100 })
  )
  return normalized.every(Boolean) ? normalized.join(' ') : null
}

function normalizeRichTextSize(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  if (!text || text === 'auto') {
    return null
  }
  return normalizeRichTextLength(text, { minPx: 1, maxPx: 1600, maxPercent: 100 })
}

function normalizeRichTextLength(
  value: string,
  options: { minPx: number; maxPx: number; maxPercent: number }
) {
  if (value === '0') {
    return '0'
  }
  const match = value.match(cssLengthPattern)
  if (!match) {
    return null
  }
  const number = Number(match[1])
  const unit = match[2].toLowerCase()
  if (!Number.isFinite(number)) {
    return null
  }
  if (unit === '%') {
    return number >= 0 && number <= options.maxPercent ? `${number}%` : null
  }
  if (unit === 'px') {
    return number >= options.minPx && number <= options.maxPx ? `${number}px` : null
  }
  if (unit === 'em' || unit === 'rem') {
    const min = options.minPx < 0 ? -20 : 0
    return number >= min && number <= 20 ? `${number}${unit}` : null
  }
  return null
}

function normalizeRichTextBorder(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  if (!text || text === 'none' || text === '0') {
    return text || null
  }
  if (
    text.length > 120 ||
    /(?:url|expression|var|calc)\s*\(/i.test(text) ||
    /[;{}<>]/.test(text)
  ) {
    return null
  }

  const parts = text.split(/\s+/).filter(Boolean)
  const hasStyle = parts.some((part) =>
    [
      'solid',
      'dashed',
      'dotted',
      'double',
      'none',
    ].includes(part)
  )
  const hasWidth = parts.some((part) =>
    Boolean(normalizeRichTextLength(part, { minPx: 0, maxPx: 32, maxPercent: 100 }))
  )
  const hasColor = parts.some((part) => Boolean(normalizeRichTextColor(part, allowedTextColors)))
  return hasStyle && (hasWidth || hasColor) ? text : null
}

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
