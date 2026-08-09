// Lucide does not publish declarations for this internal ESM index. Keeping the
// index behind one lazy import avoids generating a dynamic entry per icon.
declare module 'lucide-react/dist/esm/icons/index.js' {
  import type { LucideIcon } from 'lucide-react'

  const icons: Record<string, LucideIcon>
  export = icons
}
