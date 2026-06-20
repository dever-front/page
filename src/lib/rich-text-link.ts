const richTextHrefPattern =
  /^(https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+\.[^\s@]+|\/(?!\/)[^\s]*)$/i

export function normalizeRichTextHref(value: unknown) {
  const href = String(value || '').trim()
  if (!href) {
    return ''
  }
  if (/^(https?:\/\/|mailto:|\/)/i.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return href
  }
  return `https://${href}`
}

export function isSafeRichTextHref(value: unknown) {
  return richTextHrefPattern.test(String(value || '').trim())
}

export function safeRichTextHref(value: unknown) {
  const href = String(value || '').trim()
  return isSafeRichTextHref(href) ? href : '#'
}
