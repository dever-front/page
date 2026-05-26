/// <reference types="vite/client" />

declare module 'virtual:dever-front-plugins' {
  import type { DeverFrontPlugin } from '@/lib/plugin/types'

  const plugins: DeverFrontPlugin[]
  export default plugins
}
