import * as LucideIcons from 'lucide-react'

export type LucideIconCategoryKey =
  | 'layout'
  | 'navigation'
  | 'user'
  | 'security'
  | 'file'
  | 'media'
  | 'chart'
  | 'device'
  | 'time'
  | 'edit'
  | 'other'

export type LucideIconItem = {
  name: string
  category: LucideIconCategoryKey
}

export const lucideIconCategories: Array<{ key: LucideIconCategoryKey; label: string }> = [
  { key: 'layout', label: '布局' },
  { key: 'navigation', label: '导航' },
  { key: 'user', label: '用户' },
  { key: 'security', label: '安全' },
  { key: 'file', label: '文件' },
  { key: 'media', label: '媒体' },
  { key: 'chart', label: '图表' },
  { key: 'device', label: '设备' },
  { key: 'time', label: '时间' },
  { key: 'edit', label: '编辑' },
  { key: 'other', label: '其他' },
]

const categoryKeywords: Record<Exclude<LucideIconCategoryKey, 'all' | 'other'>, string[]> = {
  layout: [
    'layout',
    'panel',
    'sidebar',
    'grid',
    'columns',
    'rows',
    'table',
    'kanban',
    'gallery',
    'dock',
    'app-window',
    'container',
    'section',
    'wrap',
    'rectangle',
    'square',
    'frame',
    'blocks',
  ],
  navigation: [
    'arrow',
    'chevron',
    'move',
    'corner',
    'locate',
    'navigation',
    'route',
    'map',
    'signpost',
    'waypoints',
    'compass',
    'pointer',
  ],
  user: [
    'user',
    'users',
    'contact',
    'badge',
    'person',
    'baby',
    'accessibility',
    'id-card',
  ],
  security: [
    'shield',
    'lock',
    'key',
    'fingerprint',
    'scan',
    'eye',
    'bug',
    'ban',
    'alarm',
    'siren',
    'search-check',
  ],
  file: [
    'file',
    'folder',
    'archive',
    'book',
    'clipboard',
    'download',
    'upload',
    'save',
    'printer',
    'receipt',
    'notebook',
    'text',
    'copy',
    'paste',
  ],
  media: [
    'play',
    'pause',
    'stop',
    'skip',
    'rewind',
    'fast-forward',
    'camera',
    'image',
    'video',
    'mic',
    'music',
    'radio',
    'volume',
    'headphones',
  ],
  chart: [
    'chart',
    'pie',
    'bar',
    'line',
    'activity',
    'trend',
    'goal',
    'gauge',
    'radar',
    'progress',
    'signal',
  ],
  device: [
    'monitor',
    'laptop',
    'tablet',
    'smartphone',
    'watch',
    'server',
    'database',
    'hard-drive',
    'cpu',
    'memory-stick',
    'router',
    'usb',
    'bluetooth',
    'printer',
  ],
  time: [
    'clock',
    'calendar',
    'timer',
    'history',
    'alarm',
    'hourglass',
    'watch',
  ],
  edit: [
    'pen',
    'pencil',
    'eraser',
    'edit',
    'brush',
    'palette',
    'scissors',
    'wand',
    'highlighter',
    'stamp',
    'ruler',
  ],
}

function exportNameToOfficialName(name: string) {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

function resolveCategory(name: string): LucideIconCategoryKey {
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => name.includes(keyword))) {
      return category as LucideIconCategoryKey
    }
  }
  return 'other'
}

export function getLucideIconCatalog(): LucideIconItem[] {
  const names = Object.keys(LucideIcons)
    .filter((current) => /^[A-Z]/.test(current) && !current.endsWith('Icon'))
    .map(exportNameToOfficialName)
    .filter(Boolean)

  const uniqueNames = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))

  return uniqueNames.map((name) => ({
    name,
    category: resolveCategory(name),
  }))
}
