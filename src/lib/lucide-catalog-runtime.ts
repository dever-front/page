import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'
import * as LucideIcons from 'lucide-react/dist/cjs/lucide-react.js'

export type LucideCatalogModule = Record<
  string,
  ComponentType<LucideProps>
>

// Keep the complete catalog on an isolated, lazy CJS path. The regular UI uses
// tree-shaken ESM icons, so the two paths cannot create tiny shared icon chunks.
export const lucideCatalogModule =
  LucideIcons as unknown as LucideCatalogModule
