import { contentCompatSources as source } from './sources'

export const contentCompatModuleLoaders = {
  [source.contentView]: () => import('@/components/energon/content-view'),
  [source.firstFrameVideo]: () =>
    import('@/components/media/first-frame-video'),
  [source.progress]: () => import('@/components/energon/progress'),
  [source.referenceComposer]: () => import('@/components/reference-composer'),
  [source.richTextView]: () => import('@/components/rich-text-view'),
  [source.streamTiming]: () => import('@/components/stream-timing'),
  [source.floatingLayer]: () => import('@/lib/floating-layer'),
  [source.resource]: () => import('@/lib/resource'),
  [source.richTextHTML]: () => import('@/lib/rich-text-html'),
}
