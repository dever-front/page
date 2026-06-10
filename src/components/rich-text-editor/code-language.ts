const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  cjs: 'javascript',
  htm: 'xml',
  html: 'xml',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  md: 'markdown',
  py: 'python',
  sh: 'shell',
  svg: 'xml',
  ts: 'typescript',
  tsx: 'typescript',
  xhtml: 'xml',
  yml: 'yaml',
  zsh: 'shell',
}

export function normalizeCodeLanguage(value: unknown) {
  const language = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^language-/, '')

  if (!language) {
    return ''
  }

  return CODE_LANGUAGE_ALIASES[language] || language
}

export function inferCodeBlockLanguage(value: string, explicitLanguage?: unknown) {
  const language = normalizeCodeLanguage(explicitLanguage)
  if (language) {
    return language
  }

  const source = value.trim()
  if (!source) {
    return ''
  }

  if (/^(<!doctype html|<html[\s>]|<svg[\s>]|<\?xml\b)/i.test(source)) {
    return 'xml'
  }
  if (/<\/?[a-z][\w:-]*(\s[^>]*)?>/i.test(source)) {
    return 'xml'
  }
  if (/^\s*[{[]/.test(source) && /["'][\w-]+["']\s*:/.test(source)) {
    return 'json'
  }
  if (/\b(from\s+[\w.]+\s+import|import\s+[\w.]+|def\s+\w+\s*\(|print\s*\(|torch\.|os\.)/.test(source)) {
    return 'python'
  }
  if (/\b(const|let|var|function|import\s+.+\s+from|export\s+default|console\.log)\b|=>/.test(source)) {
    return 'javascript'
  }
  if (/\b(package\s+main|func\s+\w+\s*\(|fmt\.Print|type\s+\w+\s+struct)\b/.test(source)) {
    return 'go'
  }
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im.test(source)) {
    return 'sql'
  }
  if (/^\s*[-\w]+\s*:\s*.+$/m.test(source)) {
    return 'yaml'
  }
  if (/^\s*(#\!\/|sudo\s+|cd\s+|echo\s+|curl\s+|npm\s+|pnpm\s+)/m.test(source)) {
    return 'shell'
  }

  return ''
}
