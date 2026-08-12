// Lucide does not publish declarations for this internal CJS bundle. It is used
// only by the lazy full-catalog runtime; regular UI icons stay tree-shaken ESM.
declare module 'lucide-react/dist/cjs/lucide-react.js' {
  import type { LucideIcon } from 'lucide-react'

  const icons: Record<string, LucideIcon>
  export = icons
}
