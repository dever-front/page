import type { ReactNode } from 'react'
import { Search, RotateCcw } from 'lucide-react'
import { SearchableOptionPicker } from '@/components/searchable-option-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildFilterCategoryItems,
  buildFilterSourceItems,
  type ResourceCategoryItem,
  type ResourceSourceItem,
} from '@/lib/resource'

export type ResourceFilterDraft = {
  keyword: string
  fileType: string
  kind: string
  categoryId: string
  sourceKey: string
}

type ResourceFiltersProps = {
  fixedKind?: boolean
  hideCategoryFilter?: boolean
  draft: ResourceFilterDraft
  categories: ResourceCategoryItem[]
  sources: ResourceSourceItem[]
  onDraftChange: (patch: Partial<ResourceFilterDraft>) => void
  onSearch: () => void
  onReset: () => void
  actions?: ReactNode
}

const KIND_OPTIONS = [
  { id: 'all', value: '全部类型' },
  { id: 'image', value: '图片' },
  { id: 'file', value: '文件' },
  { id: 'video', value: '视频' },
  { id: 'audio', value: '音频' },
  { id: 'other', value: '其他' },
]

export function ResourceFilters({
  fixedKind,
  hideCategoryFilter,
  draft,
  categories,
  sources,
  onDraftChange,
  onSearch,
  onReset,
  actions,
}: ResourceFiltersProps) {
  const filterCategories = buildFilterCategoryItems(categories)
  const filterSources = buildFilterSourceItems(sources)
  const sourceOptions = [
    { id: 'all', value: '全部来源' },
    ...filterSources,
  ]
  const categoryOptions = [
    { id: 'all', value: '全部分类' },
    ...filterCategories,
  ]

  return (
    <div className="space-y-3 rounded-2xl border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium text-foreground">资源筛选</div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draft.keyword}
          placeholder="文件名 / 哈希"
          className="w-full sm:w-[220px]"
          onChange={(event) => onDraftChange({ keyword: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSearch()
            }
          }}
        />

        <Input
          value={draft.fileType}
          placeholder="文件后缀，例如 jpg / pdf"
          className="w-full sm:w-[200px]"
          onChange={(event) => onDraftChange({ fileType: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSearch()
            }
          }}
        />

        {!fixedKind ? (
          <Select
            value={draft.kind || 'all'}
            onValueChange={(value) => onDraftChange({ kind: value === 'all' ? '' : value })}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="资源类型" />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {filterSources.length > 0 ? (
          <SearchableOptionPicker
            value={draft.sourceKey || 'all'}
            options={sourceOptions}
            placeholder="来源"
            searchPlaceholder="输入来源关键词筛选..."
            emptyText="未找到匹配来源"
            className="w-full sm:w-[180px]"
            clearable={draft.sourceKey !== ''}
            onClear={() => onDraftChange({ sourceKey: '' })}
            onChange={(nextValue) => {
              const value = Array.isArray(nextValue) ? nextValue[0] || 'all' : nextValue
              onDraftChange({ sourceKey: value === 'all' ? '' : value })
            }}
          />
        ) : null}

        {!hideCategoryFilter && filterCategories.length > 0 ? (
          <SearchableOptionPicker
            value={draft.categoryId || 'all'}
            options={categoryOptions}
            placeholder="分类"
            searchPlaceholder="输入分类关键词筛选..."
            emptyText="未找到匹配分类"
            className="w-full sm:w-[160px]"
            clearable={draft.categoryId !== ''}
            onClear={() => onDraftChange({ categoryId: '' })}
            onChange={(nextValue) => {
              const value = Array.isArray(nextValue) ? nextValue[0] || 'all' : nextValue
              onDraftChange({ categoryId: value === 'all' ? '' : value })
            }}
          />
        ) : null}

        <Button type="button" size="sm" onClick={onSearch}>
          <Search className="size-4" />
          搜索
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onReset}>
          <RotateCcw className="size-4" />
          重置
        </Button>
      </div>
    </div>
  )
}
