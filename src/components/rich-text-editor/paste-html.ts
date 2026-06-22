import { normalizeRichTextMaxWidth } from '@/lib/rich-text'
import {
  richTextBlockStyleToCss,
  normalizeRichTextHexColor,
  richTextFontFamilies,
  richTextFontSizes,
  richTextStyleToCssText,
} from '@/lib/rich-text-style'
import { isSafeRichTextHref, normalizeRichTextHref } from '@/lib/rich-text-link'
import { resolveAssetUrl } from '@/lib/request'

export type PastedRemoteMediaKind = 'image' | 'video' | 'audio'
type EmbeddedMediaKind = Extract<PastedRemoteMediaKind, 'video' | 'audio'>

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

type PasteSourceContext = {
  baseUrl: string
}

const unsafeSelectors = [
  'script',
  'style',
  'meta',
  'link',
  'iframe',
  'object',
  'embed',
  'mp-common-videosnap',
  'mpvideosnap',
  'mpvideo',
  'mpvoice',
  'qqmusic',
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
  'BR',
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

const articleBlockTags = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE'])

const mediaExtensions: Record<PastedRemoteMediaKind, string[]> = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'],
  video: ['.mp4', '.webm', '.ogg', '.mov', '.m4v'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
}

const imageSourceAttributes = [
  'data-src',
  'data-original',
  'data-original-src',
  'data-lazy-src',
  'data-lazyload',
  'data-actualsrc',
  'data-origin-src',
  'data-url',
  'data-original-url',
  'data-raw-src',
  'data-lazy',
  'data-lazyload-src',
  'data-ks-lazyload',
  'data-imgurl',
  'data-image',
  'data-thumb',
  'data-thumburl',
  'data-cover',
  'data-poster',
  'data-backup',
  'data-echo',
  'origin-src',
  'lazy-src',
  'src',
]

const mediaSourceAttributes = [
  'src',
  'data-src',
  'data-original',
  'data-original-src',
  'data-lazy-src',
  'data-lazyload-src',
  'data-actualsrc',
  'data-url',
  'data-media-url',
  'media_url',
  'data-video-src',
  'video_src',
  'data-audio-src',
  'audio_src',
  'data-playurl',
  'data-mp4',
  'mp4',
  'data-vurl',
  'data-vidsrc',
]
const imageSourceSetAttributes = [
  'data-srcset',
  'data-original-srcset',
  'data-lazy-srcset',
  'srcset',
]
const embeddedMediaSelectors = [
  'iframe',
  'embed',
  'object',
  'mp-common-videosnap',
  'mpvideosnap',
  'mpvideo',
  'mpvoice',
  'qqmusic',
  '[data-video-url]',
  '[data-video-src]',
  '[video_src]',
  '[video_url]',
  '[data-player-url]',
  '[player_url]',
  '[data-playurl]',
  '[data-video-id]',
  '[data-mpvid]',
  '[data-vid]',
  '[vid]',
  '[data-audio-url]',
  '[data-audio-src]',
  '[audio_src]',
  '[audio_url]',
  '[voice_url]',
  '[data-voice-url]',
  '[voice_encode_fileid]',
  '[data-fileid]',
  '[music_url]',
  '[data-music-url]',
].join(',')
const videoEmbedSourceAttributes = [
  'src',
  'data',
  'data-src',
  'data-video-src',
  'video_src',
  'data-video-url',
  'video_url',
  'data-player-url',
  'player_url',
  'data-url',
  'data-media-url',
  'media_url',
  'url',
  'data-playurl',
  'data-mp4',
  'mp4',
  'data-vurl',
  'data-vidsrc',
]
const audioEmbedSourceAttributes = [
  'src',
  'data',
  'data-src',
  'data-audio-src',
  'audio_src',
  'data-audio-url',
  'audio_url',
  'voice_url',
  'data-voice-url',
  'music_url',
  'data-music-url',
  'data-url',
  'data-media-url',
  'media_url',
  'url',
]
const embeddedCoverAttributes = [
  'poster',
  'data-poster',
  'data-cover',
  'cover',
  'data-imgurl',
  'data-thumb',
  'data-image',
  'data-src',
]
const imageCaptionBlockTags = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'CENTER', 'SPAN'])
const imageCaptionStopTags = new Set([
  'IMG',
  'VIDEO',
  'AUDIO',
  'TABLE',
  'UL',
  'OL',
  'PRE',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
])
const imageCaptionStopSelector = Array.from(imageCaptionStopTags).join(',')
const MAX_IMAGE_CAPTION_LINES = 12
const MAX_IMAGE_CAPTION_LINE_LENGTH = 120
const MAX_IMAGE_CAPTION_TOTAL_LENGTH = 1000

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
  const context = resolvePasteSourceContext(rawHtml, doc)

  normalizeEmbeddedMediaElements(doc.body, context)
  normalizeBackgroundImageElements(doc.body, context)
  doc.body.querySelectorAll(unsafeSelectors).forEach((element) => element.remove())
  normalizeElements(doc.body, assets, seenAssets, context)
  normalizeImageCaptionBlocks(doc.body)

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
  seenAssets: Set<string>,
  context: PasteSourceContext
) {
  Array.from(root.querySelectorAll('font')).forEach(replaceFontElement)

  Array.from(root.querySelectorAll('*')).forEach((element) => {
    normalizeElementAttributes(element as HTMLElement)
    normalizeElementStyle(element as HTMLElement)
    normalizeAnchorElement(element as HTMLAnchorElement, context)
    normalizeMediaElement(element as HTMLElement, assets, seenAssets, context)
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
    const target = normalizeArticleBlockElement(element, styles.blockStyle)
    setStyleAttribute(target, styles.blockStyle)
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

function normalizeArticleBlockElement(element: HTMLElement, blockStyle: string) {
  if (!articleBlockTags.has(element.tagName)) {
    return element
  }

  if (hasOnlyInlineChildren(element) && element.textContent?.trim()) {
    return replaceElementTag(element, 'p')
  }

  if (blockStyle && hasBlockElementChild(element)) {
    wrapDirectInlineChildrenInParagraph(element)
    element.setAttribute('data-rich-text-block', 'true')
  }

  return element
}

function normalizeAnchorElement(element: HTMLAnchorElement, context: PasteSourceContext) {
  if (element.tagName !== 'A') {
    return
  }

  const href = normalizeRichTextHref(
    resolveRelativeUrl(element.getAttribute('href'), context.baseUrl) ||
      element.getAttribute('href')
  )
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
  seenAssets: Set<string>,
  context: PasteSourceContext
) {
  const kind = resolveElementMediaKind(element)
  if (!kind) {
    return
  }

  const sourceUrl = resolveElementMediaSource(element, kind, context)
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
  const align = resolveMediaAlign(element)
  if (align) {
    element.setAttribute('data-align', align)
  }

  collectRemoteMediaAsset(kind, sourceUrl, element, assets, seenAssets)
}

function normalizeEmbeddedMediaElements(root: ParentNode, context: PasteSourceContext) {
  Array.from(root.querySelectorAll(embeddedMediaSelectors)).forEach((element) => {
    if (!element.isConnected) {
      return
    }
    const replacement = buildEmbeddedMediaReplacement(element as HTMLElement, context)
    if (replacement) {
      element.replaceWith(replacement)
    }
  })
}

function normalizeBackgroundImageElements(root: ParentNode, context: PasteSourceContext) {
  Array.from(root.querySelectorAll('[style], [background]')).forEach((element) => {
    const htmlElement = element as HTMLElement
    if (!htmlElement.isConnected || !canReplaceBackgroundImageElement(htmlElement)) {
      return
    }

    const sourceUrl = resolveBackgroundImageSource(htmlElement, context)
    if (!sourceUrl) {
      return
    }

    htmlElement.replaceWith(
      createEmbeddedImage(htmlElement.ownerDocument, sourceUrl, htmlElement)
    )
  })
}

function normalizeImageCaptionBlocks(root: ParentNode) {
  const images = Array.from(root.querySelectorAll('img[src]')) as HTMLImageElement[]
  for (const image of images) {
    if (
      !image.isConnected ||
      image.closest('figure[data-rich-text-image], figure[data-rich-text-media]')
    ) {
      continue
    }

    const sourceFigureCaption = resolveSourceFigureCaption(image)
    if (sourceFigureCaption) {
      const figure = createCaptionedImageFigure(
        sourceFigureCaption.block,
        image,
        sourceFigureCaption.text
      )
      sourceFigureCaption.block.replaceWith(figure)
      continue
    }

    const sameContainerCaption = resolveSameContainerImageCaption(image)
    if (sameContainerCaption) {
      const figure = createCaptionedImageFigure(
        sameContainerCaption.block,
        image,
        sameContainerCaption.text
      )
      sameContainerCaption.block.replaceWith(figure)
      continue
    }

    const imageBlock = resolveCaptionableImageBlock(image)
    if (!imageBlock?.parentElement) {
      continue
    }

    const caption = resolveFollowingImageCaption(imageBlock)
    if (!caption) {
      continue
    }

    const figure = createCaptionedImageFigure(imageBlock, image, caption.text)
    imageBlock.replaceWith(figure)
    caption.nodes.forEach((node) => node.remove())
  }
}

function resolveCaptionableImageBlock(image: HTMLImageElement) {
  let candidate: HTMLElement = image
  let current = image.parentElement

  while (
    current &&
    current.tagName !== 'BODY' &&
    current.tagName !== 'TD' &&
    current.tagName !== 'TH'
  ) {
    if (!isSingleImageContainer(current, image)) {
      break
    }

    candidate = current
    current = current.parentElement
  }

  return candidate
}

function resolveSourceFigureCaption(image: HTMLImageElement) {
  const figure = image.closest('figure') as HTMLElement | null
  if (
    !figure ||
    figure.hasAttribute('data-rich-text-image') ||
    figure.hasAttribute('data-rich-text-media') ||
    !isSingleFigureImageContainer(figure, image)
  ) {
    return null
  }

  const captionElement = figure.querySelector('figcaption')
  const caption = captionElement
    ? normalizeImageCaptionText(elementTextWithBreaks(captionElement))
    : ''
  if (!isValidImageCaptionText(caption)) {
    return null
  }

  return {
    block: figure,
    text: caption,
  }
}

function isSingleFigureImageContainer(figure: HTMLElement, image: HTMLImageElement) {
  const images = Array.from(figure.querySelectorAll('img[src]'))
  return images.length === 1 && images[0] === image
}

function resolveSameContainerImageCaption(image: HTMLImageElement) {
  const container = image.parentElement
  if (
    !container ||
    container.tagName === 'BODY' ||
    !imageCaptionBlockTags.has(container.tagName) ||
    !isSingleImageContainerWithCaptionText(container, image) ||
    hasBlockElementAfterChild(container, image)
  ) {
    return null
  }

  const caption = takeCaptionTextFromLines(elementTextAfterChild(container, image))
  if (!isValidImageCaptionText(caption)) {
    return null
  }

  return {
    block: container,
    text: caption,
  }
}

function isSingleImageContainerWithCaptionText(
  container: HTMLElement,
  image: HTMLImageElement
) {
  const images = Array.from(container.querySelectorAll('img[src]'))
  if (images.length !== 1 || images[0] !== image) {
    return false
  }

  return !container.querySelector(
    'video, audio, table, ul, ol, pre, blockquote, h1, h2, h3, h4, h5, h6'
  )
}

function isSingleImageContainer(container: HTMLElement, image: HTMLImageElement) {
  const images = Array.from(container.querySelectorAll('img[src]'))
  if (images.length !== 1 || images[0] !== image) {
    return false
  }

  if (
    container.querySelector(
      'video, audio, table, ul, ol, pre, blockquote, h1, h2, h3, h4, h5, h6'
    )
  ) {
    return false
  }

  const text = elementTextWithBreaks(container).trim()
  const imageAltText = String(image.getAttribute('alt') || '').trim()
  const imageTitleText = String(image.getAttribute('title') || '').trim()
  return !text || text === imageAltText || text === imageTitleText
}

function resolveFollowingImageCaption(imageBlock: HTMLElement) {
  const captionNodes: HTMLElement[] = []
  const captionLines: string[] = []
  const gapNodes: HTMLElement[] = []
  let captionContext = ''
  let cursor = imageBlock.nextElementSibling as HTMLElement | null

  while (cursor && isIgnorableCaptionGap(cursor)) {
    gapNodes.push(cursor)
    cursor = cursor.nextElementSibling as HTMLElement | null
  }

  while (cursor && captionLines.length < MAX_IMAGE_CAPTION_LINES) {
    const candidate = resolveImageCaptionCandidate(cursor, captionContext)
    if (!candidate) {
      break
    }

    const nextCaption = [...captionLines, candidate.text].join('\n')
    if (nextCaption.length > MAX_IMAGE_CAPTION_TOTAL_LENGTH) {
      break
    }

    captionNodes.push(cursor)
    captionLines.push(candidate.text)
    captionContext = captionContext || candidate.context
    cursor = cursor.nextElementSibling as HTMLElement | null
  }

  const captionText = captionLines.join('\n').trim()
  if (!captionText) {
    return null
  }

  return {
    text: captionText,
    nodes: [...gapNodes, ...captionNodes],
  }
}

function isIgnorableCaptionGap(element: HTMLElement) {
  return (
    imageCaptionBlockTags.has(element.tagName) &&
    !element.querySelector(imageCaptionStopSelector) &&
    !elementTextWithBreaks(element).trim()
  )
}

function resolveImageCaptionCandidate(element: HTMLElement, expectedContext: string) {
  if (!imageCaptionBlockTags.has(element.tagName)) {
    return null
  }
  if (element.querySelector(imageCaptionStopSelector)) {
    return null
  }

  const text = normalizeImageCaptionText(elementTextWithBreaks(element))
  if (!isCaptionCandidateText(text)) {
    return null
  }

  const context = imageCaptionBlockContext(element)
  if (expectedContext && context !== expectedContext) {
    return null
  }
  const align = normalizeTextAlign(element.style.textAlign || element.getAttribute('align'))
  if (expectedContext || align === 'center' || looksLikeShortImageCaption(text)) {
    return {
      text,
      context,
    }
  }

  return null
}

function createCaptionedImageFigure(
  imageBlock: HTMLElement,
  image: HTMLImageElement,
  caption: string
) {
  const figure = image.ownerDocument.createElement('figure')
  const imageClone = image.cloneNode(false) as HTMLImageElement
  const blockStyle = mergeStyleText(imageBlock.getAttribute('style') || '')
  figure.setAttribute('data-rich-text-image', 'true')
  figure.setAttribute('data-rich-text-media', 'true')
  figure.setAttribute('data-rich-text-kind', 'image')
  figure.setAttribute('data-caption', caption)
  if (blockStyle) {
    figure.setAttribute('style', blockStyle)
  }

  imageClone.setAttribute('data-caption', caption)
  figure.appendChild(imageClone)

  const figcaption = image.ownerDocument.createElement('figcaption')
  figcaption.textContent = caption
  figure.appendChild(figcaption)
  return figure
}

function normalizeImageCaptionText(value: unknown) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function takeCaptionTextFromLines(value: unknown) {
  const lines = normalizeImageCaptionText(value).split('\n').filter(Boolean)
  const captionLines: string[] = []
  for (const line of lines) {
    if (!looksLikeImageCaptionLine(line)) {
      break
    }
    const nextCaption = [...captionLines, line].join('\n')
    if (!isValidImageCaptionText(nextCaption)) {
      break
    }
    captionLines.push(line)
  }
  return captionLines.join('\n')
}

function isCaptionCandidateText(text: string) {
  if (!isValidImageCaptionText(text)) {
    return false
  }
  if (looksLikeArticleParagraph(text)) {
    return false
  }
  return text.split('\n').every(looksLikeImageCaptionLine)
}

function isValidImageCaptionText(text: string) {
  if (!text || text.length > MAX_IMAGE_CAPTION_TOTAL_LENGTH) {
    return false
  }

  const lines = text.split('\n')
  return (
    lines.length <= MAX_IMAGE_CAPTION_LINES &&
    lines.every((line) => line.length <= MAX_IMAGE_CAPTION_LINE_LENGTH)
  )
}

function looksLikeShortImageCaption(text: string) {
  return text.length <= 36 && !/[。！？!?；;]$/.test(text)
}

function looksLikeImageCaptionLine(text: string) {
  return (
    Boolean(text.trim()) &&
    text.length <= MAX_IMAGE_CAPTION_LINE_LENGTH &&
    !/[。！？!?；;]/.test(text)
  )
}

function looksLikeArticleParagraph(text: string) {
  return text.length > 48 && /[。！？!?；;，,]/.test(text)
}

function imageCaptionBlockContext(element: HTMLElement) {
  const align = normalizeTextAlign(element.style.textAlign || element.getAttribute('align'))
  return [
    element.tagName,
    align,
    normalizeLineHeight(element.style.lineHeight),
    normalizeFontSize(element.style.fontSize),
    normalizeColor(element.style.color),
  ].join('|')
}

function elementTextWithBreaks(element: Element): string {
  const parts: string[] = []
  element.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      parts.push(node.textContent || '')
      return
    }
    if (node.nodeType !== 1) {
      return
    }

    const child = node as Element
    if (child.tagName === 'BR') {
      parts.push('\n')
      return
    }
    parts.push(elementTextWithBreaks(child))
  })
  return parts.join('')
}

function elementTextAfterChild(container: Element, child: Element) {
  const parts: string[] = []
  let foundChild = false
  container.childNodes.forEach((node) => {
    if (node === child) {
      foundChild = true
      return
    }
    if (!foundChild) {
      return
    }
    if (node.nodeType === 3) {
      parts.push(node.textContent || '')
      return
    }
    if (node.nodeType !== 1) {
      return
    }

    const element = node as Element
    if (element.tagName === 'BR') {
      parts.push('\n')
      return
    }
    parts.push(elementTextWithBreaks(element))
  })
  return parts.join('')
}

function hasBlockElementAfterChild(container: Element, child: Element) {
  let foundChild = false
  for (const node of Array.from(container.childNodes)) {
    if (node === child) {
      foundChild = true
      continue
    }
    if (!foundChild || node.nodeType !== 1) {
      continue
    }

    const element = node as HTMLElement
    if (element.tagName !== 'BR' && !inlineTags.has(element.tagName)) {
      return true
    }
  }
  return false
}

function buildEmbeddedMediaReplacement(
  element: HTMLElement,
  context: PasteSourceContext
) {
  const media = resolveEmbeddedMedia(element, context)
  if (!media) {
    const kind = resolveEmbeddedMediaKind(element)
    return kind && canRenderMissingEmbeddedMediaText(element)
      ? createEmbeddedMediaTextBlock(element.ownerDocument, kind, element)
      : null
  }

  const fragment = element.ownerDocument.createDocumentFragment()
  const coverUrl = resolveEmbeddedCoverSource(element, context)

  const directMedia =
    isDirectMediaURL(media.sourceUrl, media.kind) ||
    hasEmbeddedDirectMediaType(element, media.kind)
  if (directMedia) {
    if (coverUrl && media.kind === 'video') {
      fragment.appendChild(createEmbeddedImage(element.ownerDocument, coverUrl, element))
    }
    fragment.appendChild(
      createEmbeddedMediaElement(element.ownerDocument, media.kind, media.sourceUrl, element)
    )
  } else if (media.kind === 'video') {
    if (coverUrl) {
      fragment.appendChild(createEmbeddedImage(element.ownerDocument, coverUrl, element))
    } else {
      fragment.appendChild(createEmbeddedMediaTextBlock(element.ownerDocument, media.kind, element))
    }
  } else {
    fragment.appendChild(
      createEmbeddedMediaLink(
        element.ownerDocument,
        media.kind,
        media.sourceUrl,
        element,
        coverUrl
      )
    )
  }

  return fragment
}

function resolveEmbeddedMedia(
  element: HTMLElement,
  context: PasteSourceContext
): { kind: EmbeddedMediaKind; sourceUrl: string } | null {
  const kind = resolveEmbeddedMediaKind(element)
  if (!kind) {
    return null
  }

  const sourceUrl =
    kind === 'audio'
      ? resolveEmbeddedAudioSource(element, context)
      : resolveEmbeddedVideoSource(element, context)
  if (!sourceUrl) {
    return null
  }
  return { kind, sourceUrl }
}

function resolveEmbeddedMediaKind(element: HTMLElement): EmbeddedMediaKind | '' {
  const tagName = element.tagName.toLowerCase()
  if (tagName === 'mpvoice' || tagName === 'qqmusic') {
    return 'audio'
  }
  if (
    tagName === 'mp-common-videosnap' ||
    tagName === 'mpvideosnap' ||
    tagName === 'mpvideo'
  ) {
    return 'video'
  }

  const identity = embeddedElementIdentity(element)
  if (
    element.hasAttribute('data-audio-url') ||
    element.hasAttribute('data-audio-src') ||
    element.hasAttribute('audio_src') ||
    element.hasAttribute('audio_url') ||
    element.hasAttribute('voice_url') ||
    element.hasAttribute('data-voice-url') ||
    element.hasAttribute('music_url') ||
    element.hasAttribute('data-music-url') ||
    element.hasAttribute('voice_encode_fileid') ||
    /\b(audio|voice|music|podcast)\b/i.test(identity)
  ) {
    return 'audio'
  }
  if (
    element.hasAttribute('data-video-url') ||
    element.hasAttribute('data-video-src') ||
    element.hasAttribute('data-player-url') ||
    element.hasAttribute('player_url') ||
    element.hasAttribute('video_url') ||
    element.hasAttribute('data-video-id') ||
    element.hasAttribute('data-mpvid') ||
    element.hasAttribute('data-vid') ||
    element.hasAttribute('vid') ||
    /\b(video|player|media)\b/i.test(identity)
  ) {
    return 'video'
  }

  const sourceUrl = resolveEmbeddedSourceByAttributes(
    element,
    [...videoEmbedSourceAttributes, ...audioEmbedSourceAttributes],
    context
  )
  if (sourceUrl) {
    if (isDirectMediaURL(sourceUrl, 'audio')) {
      return 'audio'
    }
    if (isDirectMediaURL(sourceUrl, 'video') || isLikelyVideoEmbedURL(sourceUrl)) {
      return 'video'
    }
  }

  return ''
}

function canRenderMissingEmbeddedMediaText(element: HTMLElement) {
  return [
    'mp-common-videosnap',
    'mpvideosnap',
    'mpvideo',
    'mpvoice',
    'qqmusic',
  ].includes(element.tagName.toLowerCase())
}

function resolveEmbeddedVideoSource(element: HTMLElement, context: PasteSourceContext) {
  const sourceUrl = resolveEmbeddedSourceByAttributes(
    element,
    videoEmbedSourceAttributes,
    context
  )
  if (sourceUrl) {
    return sourceUrl
  }

  const videoId = firstAttributeValue(element, [
    'data-video-id',
    'data-mpvid',
    'data-vid',
    'vid',
  ])
  if (videoId) {
    return `https://mp.weixin.qq.com/mp/readtemplate?t=pages/video_player_tmpl&auto=0&vid=${encodeURIComponent(videoId)}`
  }

  return ''
}

function resolveEmbeddedAudioSource(element: HTMLElement, context: PasteSourceContext) {
  const sourceUrl = resolveEmbeddedSourceByAttributes(
    element,
    audioEmbedSourceAttributes,
    context
  )
  if (sourceUrl) {
    return sourceUrl
  }

  const voiceId = firstAttributeValue(element, [
    'voice_encode_fileid',
    'data-fileid',
    'fileid',
  ])
  if (voiceId) {
    return `https://mp.weixin.qq.com/cgi-bin/readtemplate?t=tmpl/audio_tmpl&voice_id=${encodeURIComponent(voiceId)}`
  }

  return ''
}

function resolveEmbeddedSourceByAttributes(
  element: HTMLElement,
  attributes: string[],
  context: PasteSourceContext
) {
  for (const attr of attributes) {
    const sourceUrl = normalizeMediaSource(element.getAttribute(attr), context.baseUrl)
    if (isEmbeddableMediaSource(sourceUrl)) {
      return sourceUrl
    }
  }

  return (
    firstNormalizedMediaSource(
      element.querySelector('source[src], source[data-src], source[data-original]'),
      mediaSourceAttributes,
      context
    ) || ''
  )
}

function resolveEmbeddedCoverSource(element: HTMLElement, context: PasteSourceContext) {
  for (const attr of embeddedCoverAttributes) {
    const sourceUrl = normalizeMediaSource(element.getAttribute(attr), context.baseUrl)
    if (isUsefulImageSource(sourceUrl) && !isLikelyVideoEmbedURL(sourceUrl)) {
      return sourceUrl
    }
  }

  const image = element.querySelector('img[src], img[data-src], img[data-original]')
  return image ? resolveImageElementSource(image as HTMLElement, context) : ''
}

function resolveBackgroundImageSource(element: HTMLElement, context: PasteSourceContext) {
  const sourceUrl =
    normalizeMediaSource(element.getAttribute('background'), context.baseUrl) ||
    normalizeMediaSource(
      firstCSSURL(
        element.style.backgroundImage ||
          element.style.getPropertyValue('background-image') ||
          element.style.background ||
          element.style.getPropertyValue('background')
      ),
      context.baseUrl
    )

  if (!isUsefulImageSource(sourceUrl) || isLikelyVideoEmbedURL(sourceUrl)) {
    return ''
  }
  return sourceUrl
}

function canReplaceBackgroundImageElement(element: HTMLElement) {
  if (['IMG', 'VIDEO', 'AUDIO', 'IFRAME', 'EMBED', 'OBJECT'].includes(element.tagName)) {
    return false
  }
  if (String(element.textContent || '').trim() || element.children.length > 0) {
    return false
  }
  return !isTinyBackgroundImageElement(element)
}

function isTinyBackgroundImageElement(element: HTMLElement) {
  const width = cssLengthPx(element.style.width || element.getAttribute('width'))
  const height = cssLengthPx(element.style.height || element.getAttribute('height'))
  return Boolean(width && height && Math.max(width, height) <= 64)
}

function hasEmbeddedDirectMediaType(element: HTMLElement, kind: EmbeddedMediaKind) {
  const mediaType = (
    firstAttributeValue(element, ['type', 'data-type']) ||
    firstAttributeValue(
      element.querySelector('source[type]') as HTMLElement | null,
      ['type']
    )
  ).toLowerCase()
  return kind === 'video' ? mediaType.startsWith('video/') : mediaType.startsWith('audio/')
}

function createEmbeddedImage(doc: Document, sourceUrl: string, sourceElement: HTMLElement) {
  const paragraph = doc.createElement('p')
  const image = doc.createElement('img')
  image.setAttribute('src', sourceUrl)
  const alt = firstAttributeValue(sourceElement, ['alt', 'title', 'data-title', 'name'])
  if (alt) {
    image.setAttribute('alt', alt)
  }
  paragraph.appendChild(image)
  return paragraph
}

function createEmbeddedMediaElement(
  doc: Document,
  kind: EmbeddedMediaKind,
  sourceUrl: string,
  sourceElement: HTMLElement
) {
  const element = doc.createElement(kind)
  element.setAttribute('src', sourceUrl)
  element.setAttribute('controls', 'controls')
  const title = firstAttributeValue(sourceElement, ['title', 'data-title', 'name'])
  if (title) {
    element.setAttribute('title', title)
  }
  return element
}

function createEmbeddedMediaLink(
  doc: Document,
  kind: EmbeddedMediaKind,
  sourceUrl: string,
  sourceElement: HTMLElement,
  coverUrl = ''
) {
  const wrapper = doc.createElement('div')
  const link = doc.createElement('a')
  const label = resolveEmbeddedMediaLabel(kind, sourceElement)
  wrapper.setAttribute('data-rich-media-embed', 'true')
  wrapper.setAttribute('data-rich-media-kind', kind)
  wrapper.setAttribute('data-rich-media-src', sourceUrl)
  wrapper.setAttribute('data-rich-media-title', label)
  if (coverUrl) {
    wrapper.setAttribute('data-rich-media-cover', coverUrl)
  }
  link.setAttribute('href', sourceUrl)
  link.setAttribute('target', '_blank')
  link.setAttribute('rel', 'noreferrer')
  link.textContent = label
  wrapper.appendChild(link)
  return wrapper
}

function createEmbeddedMediaTextBlock(
  doc: Document,
  kind: EmbeddedMediaKind,
  sourceElement: HTMLElement
) {
  const paragraph = doc.createElement('p')
  paragraph.textContent =
    firstAttributeValue(sourceElement, ['data-title', 'title', 'name', 'aria-label']) ||
    String(sourceElement.textContent || '').trim() ||
    (kind === 'video' ? '视频' : '音频')
  return paragraph
}

function resolveEmbeddedMediaLabel(
  kind: EmbeddedMediaKind,
  sourceElement: HTMLElement
) {
  const explicit = firstAttributeValue(sourceElement, [
    'data-title',
    'title',
    'name',
    'aria-label',
  ])
  if (explicit) {
    return explicit
  }
  switch (kind) {
    case 'video':
      return '查看视频'
    case 'audio':
      return '查看音频'
  }
}

function embeddedElementIdentity(element: HTMLElement) {
  return `${element.tagName} ${element.id || ''} ${element.className || ''}`.toLowerCase()
}

function firstAttributeValue(element: Element | null, attributes: string[]) {
  if (!element) {
    return ''
  }

  for (const attr of attributes) {
    const value = String(element.getAttribute(attr) || '').trim()
    if (value) {
      return value
    }
  }
  return ''
}

function firstCSSURL(value: unknown) {
  const text = String(value || '').trim()
  const match = text.match(/url\((['"]?)(.*?)\1\)/i)
  return match?.[2]?.trim() || ''
}

function cssLengthPx(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) {
    return 0
  }

  if (text.endsWith('px')) {
    const number = Number(text.slice(0, -2))
    return Number.isFinite(number) ? number : 0
  }

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const number = Number(text)
    return Number.isFinite(number) ? number : 0
  }

  return 0
}

function resolveElementMediaSource(
  element: HTMLElement,
  kind: PastedRemoteMediaKind,
  context: PasteSourceContext
) {
  if (kind === 'image') {
    return resolveImageElementSource(element, context)
  }

  return (
    firstNormalizedMediaSource(element, mediaSourceAttributes, context) ||
    firstNormalizedMediaSource(
      element.querySelector('source[src], source[data-src], source[data-original]'),
      mediaSourceAttributes,
      context
    )
  )
}

function resolveImageElementSource(element: HTMLElement, context: PasteSourceContext) {
  const directSource = firstNormalizedMediaSource(element, imageSourceAttributes, context)
  if (isUsefulImageSource(directSource)) {
    return directSource
  }

  const sourceSet =
    firstNormalizedSourceSet(element, imageSourceSetAttributes, context) ||
    firstNormalizedSourceSet(
      element.querySelector('source[srcset], source[data-srcset]'),
      imageSourceSetAttributes,
      context
    )

  return sourceSet || directSource
}

function firstNormalizedMediaSource(
  element: Element | null,
  attributes: string[],
  context: PasteSourceContext
) {
  if (!element) {
    return ''
  }

  for (const attr of attributes) {
    const source = normalizeMediaSource(element.getAttribute(attr), context.baseUrl)
    if (source) {
      return source
    }
  }
  return ''
}

function firstNormalizedSourceSet(
  element: Element | null,
  attributes: string[],
  context: PasteSourceContext
) {
  if (!element) {
    return ''
  }

  for (const attr of attributes) {
    const source = normalizeMediaSourceSet(element.getAttribute(attr), context.baseUrl)
    if (source) {
      return source
    }
  }
  return ''
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
    name: mediaAssetName(sourceUrl, element, kind),
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

  const lineHeight = normalizeLineHeight(style.lineHeight)

  const blockStyle = richTextBlockStyleToCss({
    textAlign,
    lineHeight,
    color,
    backgroundColor,
    fontSize,
    fontFamily,
    textIndent: style.textIndent,
    marginTop: style.marginTop,
    marginRight: style.marginRight,
    marginBottom: style.marginBottom,
    marginLeft: style.marginLeft,
    paddingTop: style.paddingTop,
    paddingRight: style.paddingRight,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    border: style.border,
    borderTop: style.borderTop,
    borderRight: style.borderRight,
    borderBottom: style.borderBottom,
    borderLeft: style.borderLeft,
    borderRadius: style.borderRadius,
    width: style.width,
    maxWidth: style.maxWidth,
  })

  const maxWidth = firstNormalizedMaxWidth(
    style.maxWidth,
    style.width,
    element.getAttribute('width'),
    element.getAttribute('data-w')
  )
  if (maxWidth) {
    mediaStyles.push(`max-width: ${maxWidth}`)
  }

  return {
    textStyle: textStyles.join('; '),
    blockStyle: richTextStyleToCssText(blockStyle || {}),
    mediaStyle: mediaStyles.join('; '),
  }
}

function resolveMediaAlign(element: HTMLElement) {
  let current: HTMLElement | null = element
  while (current && current.tagName !== 'BODY') {
    const align = normalizeTextAlign(
      current.style.textAlign || current.getAttribute('align')
    )
    if (align) {
      return align
    }
    current = current.parentElement
  }
  return ''
}

function resolvePasteSourceContext(rawHtml: string, doc: Document): PasteSourceContext {
  return {
    baseUrl:
      normalizeAbsoluteUrl(doc.querySelector('base[href]')?.getAttribute('href')) ||
      normalizeAbsoluteUrl(extractClipboardSourceUrl(rawHtml)),
  }
}

function extractClipboardSourceUrl(rawHtml: string) {
  const sourceMatch =
    rawHtml.match(/(?:^|\n)SourceURL:([^\n\r]+)/i) ||
    rawHtml.match(/<!--\s*SourceURL:\s*([^>]+?)\s*-->/i)
  return sourceMatch?.[1]?.trim() || ''
}

function normalizeMediaSource(value: unknown, baseUrl = '') {
  const source = String(value || '').trim()
  if (!source) {
    return ''
  }

  if (/^\/\//.test(source)) {
    return `${resolveProtocol(baseUrl)}${source}`
  }

  if (/^https?:\/\//i.test(source)) {
    return source
  }

  if (/^data:image\//i.test(source) || /^blob:/i.test(source)) {
    return source
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) {
    return ''
  }

  const resolvedSource = resolveRelativeUrl(source, baseUrl)
  if (resolvedSource) {
    return resolvedSource
  }

  if (source.startsWith('/upload/') || source.startsWith('/front/')) {
    return resolveAssetUrl(source)
  }

  return source
}

function normalizeMediaSourceSet(value: unknown, baseUrl = '') {
  return normalizeMediaSource(bestSourceSetCandidate(value), baseUrl)
}

function bestSourceSetCandidate(value: unknown) {
  const sourceSet = String(value || '').trim()
  if (!sourceSet) {
    return ''
  }

  let bestSource = ''
  let bestScore = -1
  for (const rawCandidate of sourceSet.split(',')) {
    const parts = rawCandidate.trim().split(/\s+/).filter(Boolean)
    const source = parts[0] || ''
    if (!source) {
      continue
    }

    const score = sourceSetCandidateScore(parts[1])
    if (!bestSource || score >= bestScore) {
      bestSource = source
      bestScore = score
    }
  }

  return bestSource
}

function sourceSetCandidateScore(value: unknown) {
  const descriptor = String(value || '').trim().toLowerCase()
  if (!descriptor) {
    return 1
  }
  if (descriptor.endsWith('w') || descriptor.endsWith('x')) {
    const score = Number(descriptor.slice(0, -1))
    return Number.isFinite(score) ? score : 1
  }
  return 1
}

function isUsefulImageSource(value: string) {
  if (!value) {
    return false
  }

  if (/^data:image\//i.test(value)) {
    return false
  }

  return !/(?:placeholder|blank|transparent|spacer|loading)(?:[._-]|$)/i.test(value)
}

function resolveRelativeUrl(value: unknown, baseUrl: string) {
  const source = String(value || '').trim()
  if (!source || !baseUrl) {
    return ''
  }

  if (/^(?:https?:|mailto:|data:|blob:)/i.test(source)) {
    return ''
  }

  try {
    return new URL(source, baseUrl).href
  } catch {
    return ''
  }
}

function normalizeAbsoluteUrl(value: unknown) {
  const source = String(value || '').trim()
  if (!source) {
    return ''
  }
  if (/^\/\//.test(source)) {
    return `${resolveProtocol('')}${source}`
  }
  if (!/^https?:\/\//i.test(source)) {
    return ''
  }
  try {
    return new URL(source).href
  } catch {
    return ''
  }
}

function resolveProtocol(baseUrl: string) {
  try {
    if (baseUrl) {
      return new URL(baseUrl).protocol
    }
  } catch {
    // fallback below
  }
  if (typeof window !== 'undefined') {
    return window.location.protocol
  }
  return 'https:'
}

function isTransferableRemoteMediaUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function isEmbeddableMediaSource(value: string) {
  return /^https?:\/\//i.test(value)
}

function isDirectMediaURL(sourceUrl: string, kind: PastedRemoteMediaKind) {
  if (kind === 'video' && isLikelyDownloadableVideoURL(sourceUrl)) {
    return true
  }

  const extension = resolveMediaExtension(sourceUrl)
  if (!extension) {
    return false
  }
  return mediaExtensions[kind].includes(extension)
}

function isLikelyDownloadableVideoURL(sourceUrl: string) {
  try {
    const parsed = new URL(sourceUrl)
    const host = parsed.host.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const query = parsed.search.toLowerCase()
    if (host.includes('findermp.video.qq.com') && path.includes('stodownload')) {
      return true
    }
    return (
      host.includes('video.qq.com') &&
      path.includes('stodownload') &&
      query.includes('encfilekey=')
    )
  } catch {
    return false
  }
}

function isLikelyVideoEmbedURL(sourceUrl: string) {
  const text = String(sourceUrl || '').toLowerCase()
  if (!/^https?:\/\//i.test(text)) {
    return false
  }
  return [
    'video',
    'player',
    'youtube.com',
    'youtu.be',
    'bilibili.com',
    'v.qq.com',
    'youku.com',
    'iqiyi.com',
    'vimeo.com',
    'douyin.com',
    'iesdouyin.com',
    'kuaishou.com',
    'ixigua.com',
    'xigua',
    'mp.weixin.qq.com/mp/readtemplate',
    'vid=',
  ].some((pattern) => text.includes(pattern))
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

function mediaAssetName(
  sourceUrl: string,
  element: HTMLElement,
  kind: PastedRemoteMediaKind
) {
  const explicitName = String(
    element.getAttribute('title') || element.getAttribute('alt') || ''
  ).trim()
  if (explicitName) {
    return ensureMediaAssetExtension(explicitName, kind)
  }

  try {
    const parsed = new URL(sourceUrl)
    const parts = decodeURIComponent(parsed.pathname).split('/').filter(Boolean)
    if (parts.length > 0) {
      return ensureMediaAssetExtension(parts[parts.length - 1], kind)
    }
  } catch {
    // fallback below
  }

  const extension = resolveMediaExtension(sourceUrl)
  return `remote-media${extension || defaultMediaAssetExtension(kind)}`
}

function ensureMediaAssetExtension(name: string, kind: PastedRemoteMediaKind) {
  const trimmedName = name.trim() || `remote-media${defaultMediaAssetExtension(kind)}`
  if (/\.[a-z0-9]{2,8}$/i.test(trimmedName)) {
    return trimmedName
  }
  return `${trimmedName}${defaultMediaAssetExtension(kind)}`
}

function defaultMediaAssetExtension(kind: PastedRemoteMediaKind) {
  switch (kind) {
    case 'video':
      return '.mp4'
    case 'audio':
      return '.mp3'
    default:
      return ''
  }
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

function normalizeLineHeight(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  if (!text || text === 'normal') {
    return text === 'normal' ? text : ''
  }
  const match = text.match(/^(\d+(?:\.\d+)?)(px|em|rem|%)?$/)
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

function normalizeDataWidth(value: unknown) {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }
  const number = Number(text)
  return Number.isFinite(number) && number > 0 ? `${number}px` : ''
}

function firstNormalizedMaxWidth(...values: unknown[]) {
  for (const value of values) {
    const normalized =
      normalizeRichTextMaxWidth(value) || normalizeRichTextMaxWidth(normalizeDataWidth(value))
    if (normalized) {
      return normalized
    }
  }
  return ''
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

function hasBlockElementChild(element: HTMLElement) {
  return Array.from(element.children).some((child) => !inlineTags.has(child.tagName))
}

function wrapDirectInlineChildrenInParagraph(element: HTMLElement) {
  let paragraph: HTMLElement | null = null
  const nodes = Array.from(element.childNodes)

  nodes.forEach((node) => {
    if (!isDirectInlineContentNode(node)) {
      paragraph = null
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
        node.remove()
      }
      return
    }

    if (!paragraph) {
      paragraph = element.ownerDocument.createElement('p')
      element.insertBefore(paragraph, node)
    }
    paragraph.appendChild(node)
  })
}

function isDirectInlineContentNode(node: ChildNode) {
  if (node.nodeType === Node.TEXT_NODE) {
    return Boolean(node.textContent?.trim())
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false
  }
  return inlineTags.has((node as HTMLElement).tagName)
}

function isBlockElement(element: HTMLElement) {
  return !inlineTags.has(element.tagName)
}

function replaceElementTag(element: HTMLElement, tagName: string) {
  const replacement = element.ownerDocument.createElement(tagName)
  Array.from(element.attributes).forEach((attr) => {
    replacement.setAttribute(attr.name, attr.value)
  })
  moveChildren(element, replacement)
  element.replaceWith(replacement)
  return replacement
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
