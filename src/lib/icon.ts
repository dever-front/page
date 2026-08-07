import {
  Suspense,
  createElement,
  lazy,
  type ComponentType,
} from 'react'
import type { LucideProps } from 'lucide-react'

type LucideModule = typeof import('lucide-react')
type LucideComponent = ComponentType<LucideProps>

const resolvedIcons = new Map<string, LucideComponent>()
const MissingIcon: LucideComponent = () => null
let lucideModulePromise: Promise<LucideModule> | undefined

function officialNameToExportName(name: string) {
  return name
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function resolveLucideIcon(name?: string) {
  if (!name) return null
  const exportName = officialNameToExportName(name)
  if (!exportName) return null

  const cached = resolvedIcons.get(exportName)
  if (cached) return cached

  const DeferredIcon = createDeferredIcon(exportName)
  resolvedIcons.set(exportName, DeferredIcon)
  return DeferredIcon
}

function createDeferredIcon(exportName: string): LucideComponent {
  const Icon = lazy(async () => {
    const module = await loadLucideModule()
    return {
      default:
        (module[exportName as keyof LucideModule] as
          | LucideComponent
          | undefined) ?? MissingIcon,
    }
  })

  const DeferredIcon: LucideComponent = (props) =>
    createElement(
      Suspense,
      { fallback: createIconPlaceholder(props) },
      createElement(Icon, props)
    )
  DeferredIcon.displayName = `DeferredLucideIcon(${exportName})`
  return DeferredIcon
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
    lucideModulePromise = import('lucide-react').catch((error) => {
      lucideModulePromise = undefined
      throw error
    })
  }
  return lucideModulePromise
}
