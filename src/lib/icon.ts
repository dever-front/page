import { Suspense, createElement, lazy, type ComponentType } from 'react'
import {
  AlignLeft,
  Archive,
  ArrowLeft,
  AudioLines,
  Badge,
  BadgeDollarSign,
  Bell,
  Blocks,
  Book,
  BookOpen,
  BookOpenText,
  Bot,
  Braces,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CircleCheck,
  CircleDollarSign,
  CircleDot,
  CirclePlay,
  CirclePlus,
  Clapperboard,
  ClipboardList,
  CloudUpload,
  Code2,
  Coins,
  Contact2,
  ContactRound,
  Copy,
  Cpu,
  Database,
  Download,
  Eye,
  FileCog,
  FileJson,
  FileStack,
  FileText,
  Files,
  FolderKanban,
  FolderOpen,
  FolderTree,
  Gift,
  GitBranch,
  Globe,
  History,
  IdCard,
  Image as ImageIcon,
  KeyRound,
  Link,
  ListChecks,
  ListFilter,
  ListPlus,
  ListTree,
  LogIn,
  MapPinned,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
  Mic,
  Music4,
  Network,
  PackageOpen,
  Palette,
  Play,
  Plug,
  PlugZap,
  Plus,
  ReceiptText,
  RefreshCw,
  Route,
  Save,
  Send,
  ServerCog,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Star,
  Tags,
  ToggleLeft,
  Trash2,
  TriangleAlert,
  Type,
  Users,
  UsersRound,
  Video,
  Volume1,
  Zap,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

type LucideModule = typeof import('lucide-react/dist/esm/icons/index.js')
type LucideComponent = ComponentType<LucideProps>

const commonLucideIcons: Record<string, LucideComponent> = {
  'align-left': AlignLeft,
  archive: Archive,
  'arrow-left': ArrowLeft,
  'audio-lines': AudioLines,
  badge: Badge,
  'badge-dollar-sign': BadgeDollarSign,
  bell: Bell,
  blocks: Blocks,
  book: Book,
  'book-open': BookOpen,
  'book-open-text': BookOpenText,
  bot: Bot,
  braces: Braces,
  'briefcase-business': BriefcaseBusiness,
  'building-2': Building2,
  calendar: Calendar,
  'calendar-check': CalendarCheck,
  'calendar-clock': CalendarClock,
  'calendar-days': CalendarDays,
  check: Check,
  'circle-check': CircleCheck,
  'circle-dollar-sign': CircleDollarSign,
  'circle-dot': CircleDot,
  'circle-play': CirclePlay,
  'circle-plus': CirclePlus,
  clapperboard: Clapperboard,
  'clipboard-list': ClipboardList,
  'cloud-upload': CloudUpload,
  'code-2': Code2,
  coins: Coins,
  'contact-2': Contact2,
  'contact-round': ContactRound,
  copy: Copy,
  cpu: Cpu,
  database: Database,
  download: Download,
  eye: Eye,
  'file-cog': FileCog,
  'file-json': FileJson,
  'file-stack': FileStack,
  'file-text': FileText,
  files: Files,
  'folder-kanban': FolderKanban,
  'folder-open': FolderOpen,
  'folder-tree': FolderTree,
  gift: Gift,
  'git-branch': GitBranch,
  globe: Globe,
  history: History,
  'id-card': IdCard,
  image: ImageIcon,
  'key-round': KeyRound,
  link: Link,
  'list-checks': ListChecks,
  'list-filter': ListFilter,
  'list-plus': ListPlus,
  'list-tree': ListTree,
  'log-in': LogIn,
  'map-pinned': MapPinned,
  'message-circle': MessageCircle,
  'message-square-text': MessageSquareText,
  'messages-square': MessagesSquare,
  mic: Mic,
  'music-4': Music4,
  network: Network,
  'package-open': PackageOpen,
  palette: Palette,
  play: Play,
  plug: Plug,
  'plug-zap': PlugZap,
  plus: Plus,
  'receipt-text': ReceiptText,
  'refresh-cw': RefreshCw,
  route: Route,
  save: Save,
  send: Send,
  'server-cog': ServerCog,
  settings: Settings,
  shield: Shield,
  'shield-check': ShieldCheck,
  'sliders-horizontal': SlidersHorizontal,
  sparkles: Sparkles,
  'square-pen': SquarePen,
  star: Star,
  tags: Tags,
  'toggle-left': ToggleLeft,
  'trash-2': Trash2,
  'triangle-alert': TriangleAlert,
  type: Type,
  users: Users,
  'users-round': UsersRound,
  video: Video,
  'volume-1': Volume1,
  zap: Zap,
}
const commonLucideIconsByCompactName = new Map<string, LucideComponent>()
for (const [name, Icon] of Object.entries(commonLucideIcons)) {
  commonLucideIconsByCompactName.set(name.replace(/-/g, ''), Icon)
}

const resolvedIcons = new Map<string, LucideComponent>()
const MissingIcon: LucideComponent = () => null
let lucideModulePromise: Promise<LucideModule> | undefined

function normalizeLucideIconName(name: string) {
  return name
    .trim()
    .replace(/^i-lucide-/i, '')
    .replace(/^lucide[:/\\-]/i, '')
    .replace(/Icon$/i, '')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export function resolveLucideIcon(name?: string) {
  if (!name || name.trim().startsWith('$')) return null
  const iconName = normalizeLucideIconName(name)
  if (!iconName) return null

  const commonIcon = resolveCommonLucideIcon(iconName)
  if (commonIcon) return commonIcon

  const cached = resolvedIcons.get(iconName)
  if (cached) return cached

  const DeferredIcon = createDeferredIcon(iconName)
  resolvedIcons.set(iconName, DeferredIcon)
  return DeferredIcon
}

function createDeferredIcon(iconName: string): LucideComponent {
  const Icon = lazy(async () => {
    const module = await loadLucideModule()
    return {
      default: resolveLucideModuleIcon(module, iconName) ?? MissingIcon,
    }
  })

  const DeferredIcon: LucideComponent = (props) =>
    createElement(
      Suspense,
      { fallback: createIconPlaceholder(props) },
      createElement(Icon, props)
    )
  DeferredIcon.displayName = `DeferredLucideIcon(${iconName})`
  return DeferredIcon
}

function resolveCommonLucideIcon(iconName: string) {
  return (
    commonLucideIcons[iconName] ??
    commonLucideIconsByCompactName.get(iconName.replace(/-/g, ''))
  )
}

function resolveLucideModuleIcon(module: LucideModule, iconName: string) {
  const exportName = iconName
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  return module[exportName as keyof LucideModule] as LucideComponent | undefined
}

function createIconPlaceholder(props: LucideProps) {
  return createElement('svg', {
    'aria-hidden': true,
    className: props.className,
    focusable: false,
    height: props.height ?? props.size ?? 24,
    style: { ...props.style, visibility: 'hidden' },
    viewBox: '0 0 24 24',
    width: props.width ?? props.size ?? 24,
  })
}

function loadLucideModule() {
  if (!lucideModulePromise) {
    lucideModulePromise = import(
      'lucide-react/dist/esm/icons/index.js'
    ).catch((error) => {
      lucideModulePromise = undefined
      throw error
    })
  }
  return lucideModulePromise
}
