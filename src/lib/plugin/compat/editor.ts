import { editorCompatSources as source } from './sources'

export const editorCompatModuleLoaders = {
  [source.richTextEditor]: () => import('@/components/rich-text-editor'),
}
