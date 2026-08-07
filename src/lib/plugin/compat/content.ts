import * as contentView from '@/components/energon/content-view'
import * as progress from '@/components/energon/progress'
import * as referenceComposer from '@/components/reference-composer'
import * as richTextView from '@/components/rich-text-view'
import * as streamTiming from '@/components/stream-timing'
import * as floatingLayer from '@/lib/floating-layer'
import * as resource from '@/lib/resource'
import * as richTextHTML from '@/lib/rich-text-html'
import { contentCompatSources as source } from './sources'

export const compatModules = {
  [source.contentView]: contentView,
  [source.progress]: progress,
  [source.referenceComposer]: referenceComposer,
  [source.richTextView]: richTextView,
  [source.streamTiming]: streamTiming,
  [source.floatingLayer]: floatingLayer,
  [source.resource]: resource,
  [source.richTextHTML]: richTextHTML,
}
