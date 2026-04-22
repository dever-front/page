import * as LucideIcons from 'lucide-react'

function officialNameToExportName(name: string) {
  return name
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function resolveLucideIcon(name?: string) {
  if (!name) return null
  return (LucideIcons as any)[officialNameToExportName(name)] ?? null
}
