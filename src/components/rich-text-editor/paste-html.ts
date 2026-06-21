import { normalizeRichTextMaxWidth } from '@/lib/rich-text'
import {
  normalizeRichTextHexColor,
  richTextFontFamilies,
  richTextFontSizes,
} from '@/lib/rich-text-style'
import { isSafeRichTextHref, normalizeRichTextHref } from '@/lib/rich-text-link'
import { resolveAssetUrl } from '@/lib/request'

export type PastedRemoteMediaKind = 'image' | 'video' | 'audio'

export type PastedRemoteMediaAsset = {
  kind: PastedRemoteMediaKind
  sourceUrl: string
  name: string
}

type StyleParts = {
  textStyle: string
  blockStyle: string
  mediaStyle: string
}

const unsafeSelectors = [
  'script',
  'style',
  'meta',
  'link',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
].join(',')

const inlineTags = new Set([
  'A',
  'ABBR',
  'B',
  'BDI',
  'BDO',
  'CITE',
  'CODE',
  'DEL',
  'DFN',
  'EM',
  'I',
  'INS',
  'KBD',
  'MARK',
  'Q',
  'S',
  'SAMP',
  'SMALL',
  'SPAN',
  'STRIKE',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'U',
  'VAR',
])

const mediaExtensions: Record<PastedRemoteMediaKind, string[]> = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'],
  video: ['.mp4', '.webm', '.ogg', '.mov', '.m4v'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
}

export function normalizePastedRichTextHTML(rawHtml: string) {
  if (typeof DOMParser === 'undefined') {
    return {
      html: rawHtml,
      assets: [],
    }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(rawHtml, 'text/html')
  const assets: PastedRemoteMediaAsset[] = []
  const seenAssets = new Set<string>()

  doc.body.querySelectorAll(unsafeSelectors).forEach((element) => element.remove())
  normalizeElements(doc.body, assets, seenAssets)

  return {
    html: doc.body.innerHTML,
    assets,
  }
}

export function pastedMediaAssetKey(asset: PastedRemoteMediaAsset) {
  return `${asset.kind}:${asset.sourceUrl}`
}

export function pastedMediaKindLabel(kind: PastedRemoteMediaKind) {
  switch (kind) {
    case 'image':
      return '图片'
    case 'video':
      return '视频'
    case 'audio':
      return '音频'
  }
}

function normalizeElements(
  root: ParentNode,
  assets: PastedRemoteMediaAsset[],
  seenAssets: Set<string>
) {
  Array.from(root.querySelectorAll('font')).forEach(replaceFontElement)

  Array.from(root.querySelectorAll('*')).forEach((element) => {
    normalizeElementAttributes(element as HTMLElement)
    normalizeElementStyle(element as HTMLElement)
    normalizeAnchorElement(element as HTMLAnchorElement)
    normalizeMediaElement(element as HTMLElement, assets, seenAssets)
  })
}

function replaceFontElement(element: Element) {
  const span = element.ownerDocument.createElement('span')
  moveChildren(element, span)

  const color = normalizeColor(element.getAttribute('color'))
  const size = normalizeFontElementSize(element.getAttribute('size'))
  const styles: string[] = []
  if (color) {
    styles.push(`color: ${color}`)
  }
  if (size) {
    styles.push(`font-size: ${size}`)
  }
  if (styles.length > 0) {
    span.setAttribute('style', styles.join('; '))
  }

  element.replaceWith(span)
}

function normalizeElementAttributes(element: HTMLElement) {
  Array.from(element.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on') || name === 'class' || name === 'id') {
      element.removeAttribute(attr.name)
    }
  })
}

function normalizeElementStyle(element: HTMLElement) {
  const styles = buildSupportedStyleParts(element)
  const tagName = element.tagName

  if (tagName === 'IMG' || tagName === 'VIDEO' || tagName === 'AUDIO') {
    setStyleAttribute(element, mergeStyleText(styles.mediaStyle))
    return
  }

  if (isBlockElement(element)) {
    setStyleAttribute(element, styles.blockStyle)
    if (styles.textStyle && hasOnlyInlineChildren(element)) {
      wrapChildrenInStyledSpan(element, styles.textStyle)
    }
    return
  }

  if (tagName === 'SPAN') {
    setStyleAttribute(element, styles.textStyle)
    return
  }

  setStyleAttribute(element, '')
  if (styles.textStyle && inlineTags.has(tagName)) {
    wrapChildrenInStyledSpan(element, styles.textStyle)
  }
}

function normalizeAnchorElement(element: HTMLAnchorElement) {
  if (element.tagName !== 'A') {
    return
  }

  const href = normalizeRichTextHref(element.getAttribute('href'))
  if (!href || !isSafeRichTextHref(href)) {
    element.removeAttribute('href')
    return
  }

  element.setAttribute('href', href)
  element.setAttribute('target', '_blank')
  element.setAttribute('rel', 'noreferrer')
}

function normalizeMediaElement(
  element: HTMLElement,
  assets: PastedRemoteMediaAsset[],
  seenAssets: Set<string>
) {
  const kind = resolveElementMediaKind(element)
  if (!kind) {
    return
  }

  const sourceUrl = normalizeMediaSource(
    element.getAttribute('src') ||
      element.querySelector('source[src]')?.getAttribute('src')
  )
  if (!sourceUrl) {
    element.remove()
    return
  }

  element.setAttribute('src', sourceUrl)
  if (kind !== 'image') {
    element.setAttribute('controls', 'controls')
    element.querySelectorAll('source').forEach((source) => source.remove())
  }

  if (kind === 'image') {
    normalizeImageAttributes(element as HTMLImageElement)
  }

  collectRemoteMediaAsset(kind, sourceUrl, element, assets, seenAssets)
}

function normalizeImageAttributes(element: HTMLImageElement) {
  const alt = String(element.getAttribute('alt') || '').trim()
  const title = String(element.getAttribute('title') || '').trim()
  element.setAttribute('alt', alt)
  if (title) {
    element.setAttribute('title', title)
  } else {
    element.removeAttribute('title')
  }
}

function collectRemoteMediaAsset(
  kind: PastedRemoteMediaKind,
  sourceUrl: string,
  element: HTMLElement,
  assets: PastedRemoteMediaAsset[],
  seenAssets: Set<string>
) {
  if (!isTransferableRemoteMediaUrl(sourceUrl) || isInternalMediaUrl(sourceUrl)) {
    return
  }

  const key = `${kind}:${sourceUrl}`
  if (seenAssets.has(key)) {
    return
  }

  seenAssets.add(key)
  assets.push({
    kind,
    sourceUrl,
    name: mediaAssetName(sourceUrl, element),
  })
}

function resolveElementMediaKind(element: HTMLElement): PastedRemoteMediaKind | '' {
  switch (element.tagName) {
    case 'IMG':
      return 'image'
    case 'VIDEO':
      return 'video'
    case 'AUDIO':
      return 'audio'
    default:
      return ''
  }
}

function buildSupportedStyleParts(element: HTMLElement): StyleParts {
  const style = element.style
  const textStyles: string[] = []
  const blockStyles: string[] = []
  const mediaStyles: string[] = []

  const color = normalizeColor(style.color || element.getAttribute('color'))
  if (color) {
    textStyles.push(`color: ${color}`)
  }

  const backgroundColor = normalizeColor(
    style.backgroundColor || element.getAttribute('bgcolor')
  )
  if (backgroundColor) {
    textStyles.push(`background-color: ${backgroundColor}`)
  }

  const fontSize = normalizeFontSize(style.fontSize)
  if (fontSize) {
    textStyles.push(`font-size: ${fontSize}`)
  }

  const fontFamily = normalizeFontFamily(style.fontFamily)
  if (fontFamily) {
    textStyles.push(`font-family: ${fontFamily}`)
  }

  const textAlign = normalizeTextAlign(style.textAlign || element.getAttribute('align'))
  if (textAlign) {
    blockStyles.push(`text-align: ${textAlign}`)
  }

  const maxWidth = normalizeRichTextMaxWidth(style.maxWidth || element.getAttribute('width'))
  if (maxWidth) {
    mediaStyles.push(`max-width: ${maxWidth}`)
  }

  return {
    textStyle: textStyles.join('; '),
    blockStyle: blockStyles.join('; '),
    mediaStyle: mediaStyles.join('; '),
  }
}

function normalizeMediaSource(value: unknown) {
  const source = String(value || '').trim()
  if (!source) {
    return ''
  }

  if (/^\/\//.test(source) && typeof window !== 'undefined') {
    return `${window.location.protocol}${source}`
  }

  if (/^https?:\/\//i.test(source)) {
    return source
  }

  if (source.startsWith('/upload/') || source.startsWith('/front/')) {
    return resolveAssetUrl(source)
  }

  return source
}

function isTransferableRemoteMediaUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function isInternalMediaUrl(value: string) {
  if (!value) {
    return false
  }

  if (value.startsWith('/upload/') || value.startsWith('/front/upload/')) {
    return true
  }

  if (!/^https?:\/\//i.test(value) || typeof window === 'undefined') {
    return false
  }

  const internalOrigins = new Set<string>([window.location.origin])
  const uploadOpenUrl = resolveAssetUrl('/upload/open')
  try {
    internalOrigins.add(new URL(uploadOpenUrl, window.location.origin).origin)
  } catch {
    // ignore invalid runtime URL
  }

  try {
    const parsed = new URL(value, window.location.origin)
    if (!internalOrigins.has(parsed.origin)) {
      return false
    }
    return /\/upload\//.test(parsed.pathname)
  } catch {
    return false
  }
}

function mediaAssetName(sourceUrl: string, element: HTMLElement) {
  const explicitName = String(
    element.getAttribute('title') || element.getAttribute('alt') || ''
  ).trim()
  if (explicitName) {
    return explicitName
  }

  try {
    const parsed = new URL(sourceUrl)
    const parts = decodeURIComponent(parsed.pathname).split('/').filter(Boolean)
    if (parts.length > 0) {
      return parts[parts.length - 1]
    }
  } catch {
    // fallback below
  }

  const extension = resolveMediaExtension(sourceUrl)
  return `remote-media${extension || ''}`
}

function normalizeColor(value: unknown) {
  const color = String(value || '').trim()
  if (!color) {
    return ''
  }

  const hexColor = normalizeRichTextHexColor(color)
  if (hexColor) {
    return hexColor
  }

  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/i)
  if (!rgb) {
    return ''
  }

  return normalizeRichTextHexColor(
    `#${toHexColorPart(rgb[1])}${toHexColorPart(rgb[2])}${toHexColorPart(rgb[3])}`
  )
}

function normalizeFontSize(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) {
    return ''
  }

  const px = Number(text.endsWith('px') ? text.slice(0, -2) : '')
  if (Number.isFinite(px) && px > 0) {
    return nearestFontSize(px)
  }

  const pt = Number(text.endsWith('pt') ? text.slice(0, -2) : '')
  if (Number.isFinite(pt) && pt > 0) {
    return nearestFontSize(pt * (4 / 3))
  }

  return ''
}

function normalizeFontElementSize(value: unknown) {
  const size = Number(value)
  if (!Number.isFinite(size)) {
    return ''
  }

  const pxByFontSize: Record<number, number> = {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 24,
    6: 32,
    7: 32,
  }
  return nearestFontSize(pxByFontSize[Math.round(size)] || 16)
}

function nearestFontSize(px: number) {
  let best = richTextFontSizes[0]?.value || ''
  let bestDistance = Number.POSITIVE_INFINITY
  for (const option of richTextFontSizes) {
    const optionSize = Number(String(option.value).replace(/px$/, ''))
    const distance = Math.abs(optionSize - px)
    if (distance < bestDistance) {
      best = option.value
      bestDistance = distance
    }
  }
  return best
}

function normalizeFontFamily(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) {
    return ''
  }

  const matched = richTextFontFamilies.find((item) =>
    text.includes(item.label.toLowerCase()) ||
    text.includes(
      String(item.value).toLowerCase().split(',')[0].replace(/"/g, '')
    )
  )
  if (matched) {
    return matched.value
  }

  if (/songti|simsun|serif/.test(text)) {
    return richTextFontFamilies.find((item) => item.label === '宋体')?.value || ''
  }
  if (/mono|consolas|courier/.test(text)) {
    return richTextFontFamilies.find((item) => item.label === '等宽')?.value || ''
  }
  if (/yahei|pingfang|heiti|simhei|sans/.test(text)) {
    return richTextFontFamilies.find((item) => item.label === '微软雅黑')?.value || ''
  }

  return ''
}

function normalizeTextAlign(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  return ['left', 'center', 'right', 'justify'].includes(text) ? text : ''
}

function wrapChildrenInStyledSpan(element: HTMLElement, style: string) {
  if (!style || element.childNodes.length === 0) {
    return
  }

  const span = element.ownerDocument.createElement('span')
  span.setAttribute('style', style)
  moveChildren(element, span)
  element.appendChild(span)
}

function moveChildren(source: Element, target: Element) {
  while (source.firstChild) {
    target.appendChild(source.firstChild)
  }
}

function hasOnlyInlineChildren(element: HTMLElement) {
  return Array.from(element.children).every((child) => inlineTags.has(child.tagName))
}

function isBlockElement(element: HTMLElement) {
  return !inlineTags.has(element.tagName)
}

function setStyleAttribute(element: HTMLElement, style: string) {
  const nextStyle = mergeStyleText(style)
  if (nextStyle) {
    element.setAttribute('style', nextStyle)
  } else {
    element.removeAttribute('style')
  }
}

function mergeStyleText(style: string) {
  return String(style || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('; ')
}

function resolveMediaExtension(sourceUrl: string) {
  try {
    const pathname = new URL(sourceUrl).pathname.toLowerCase()
    for (const extensions of Object.values(mediaExtensions)) {
      const extension = extensions.find((current) => pathname.endsWith(current))
      if (extension) {
        return extension
      }
    }
  } catch {
    // ignore invalid URL
  }
  return ''
}

function toHexColorPart(value: string) {
  const number = Math.max(0, Math.min(255, Number(value) || 0))
  return number.toString(16).padStart(2, '0')
}
