import { useStore } from 'zustand'
import { ResourceBrowser } from '@/components/resource/resource-browser'
import {
  normalizeResourceUploadRules,
  type ResourceScope,
} from '@/lib/resource'
import type { NodeItemProps } from '../../nodes'

export function ShowResource({ item, store }: NodeItemProps) {
  const initialScope = String(item.meta?.initialScope || '').trim()
  const categoryIdPath = String(item.meta?.categoryIdPath || '').trim()
  const changeVersionPath = String(item.meta?.changeVersionPath || '').trim()
  const categoryId = useStore(store, (state) =>
    categoryIdPath ? String(state.getValueByPath(categoryIdPath) || '').trim() : ''
  )
  const refreshVersion = useStore(store, (state) =>
    changeVersionPath ? Number(state.getValueByPath(changeVersionPath) || 0) : 0
  )

  const handleChanged = () => {
    if (!changeVersionPath) {
      return
    }

    const currentValue = Number(store.getState().getValueByPath(changeVersionPath) || 0)
    store.getState().setValueByPath(changeVersionPath, currentValue + 1)
  }

  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <ResourceBrowser
        bizKey={String(item.meta?.bizKey || '').trim()}
        initialScope={initialScope ? (initialScope as ResourceScope) : undefined}
        defaultKind={String(item.meta?.defaultKind || '').trim()}
        fixedKind={item.meta?.fixedKind === true}
        cardDensity={String(item.meta?.cardDensity || '').trim() === 'compact' ? 'compact' : undefined}
        controlledCategoryId={categoryId}
        hideCategoryFilter={item.meta?.hideCategoryFilter === true}
        allowCategoryAssign={item.meta?.allowCategoryAssign === true}
        allowBatchSelect={item.meta?.allowBatchSelect === true}
        allowUpload={item.meta?.allowUpload !== false}
        emptyText={String(item.meta?.emptyText || '').trim() || undefined}
        uploadRules={normalizeResourceUploadRules(item.meta?.uploadRules)}
        refreshVersion={refreshVersion}
        onChanged={handleChanged}
      />
    </div>
  )
}
