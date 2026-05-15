import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { FolderOpen, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResourceCard } from '@/components/resource/resource-card'
import { ResourcePreviewDialogLazy } from '@/components/resource/lazy-dialogs'
import {
  ResourceFilters,
  type ResourceFilterDraft,
} from '@/components/resource/resource-filters'
import {
  assignResourceCategory,
  assignResourceCategories,
  isSameUploadSelectionItem,
  mergeResourceUploadRules,
  normalizeResourceCategoryId,
  normalizeResourceUploadRules,
  resolveUploadActionLabel,
  UNCATEGORIZED_RESOURCE_CATEGORY,
  type ResourceUploadRule,
} from '@/lib/resource'
import { uploadFileByRule, type UploadFileItem } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useResourceCatalog } from './use-resource-catalog'
import { useResourceList } from './use-resource-list'
import { useResourceSelection } from './use-resource-selection'

type ResourceBrowserProps = {
  bizKey?: string
  initialScope?: 'current' | 'all'
  defaultKind?: string
  fixedKind?: boolean
  cardDensity?: 'default' | 'compact'
  controlledCategoryId?: string
  hideCategoryFilter?: boolean
  allowCategoryAssign?: boolean
  allowBatchSelect?: boolean
  allowUpload?: boolean
  uploadRules?: ResourceUploadRule[]
  selectionMode?: 'browse' | 'single' | 'multiple'
  selectedItems?: UploadFileItem[]
  maxSelection?: number
  emptyText?: string
  className?: string
  refreshVersion?: string | number
  onSelectedItemsChange?: (items: UploadFileItem[]) => void
  onChanged?: () => void
}

const DEFAULT_PAGE_SIZE = 24

export function ResourceBrowser({
  bizKey = '',
  initialScope,
  defaultKind = '',
  fixedKind = false,
  cardDensity,
  controlledCategoryId = '',
  hideCategoryFilter = false,
  allowCategoryAssign = false,
  allowBatchSelect = false,
  allowUpload = true,
  uploadRules = [],
  selectionMode = 'browse',
  selectedItems = [],
  maxSelection = 1,
  emptyText = '暂无资源。',
  className,
  refreshVersion = 0,
  onSelectedItemsChange,
  onChanged,
}: ResourceBrowserProps) {
  const normalizedUploadRules = useMemo(
    () => normalizeResourceUploadRules(uploadRules),
    [uploadRules]
  )
  const uploadRuleMetas = useUploadRuleMetas(normalizedUploadRules.map((current) => current.ruleId))
  const effectiveUploadRules = useMemo(
    () => mergeResourceUploadRules(normalizedUploadRules, uploadRuleMetas),
    [normalizedUploadRules, uploadRuleMetas]
  )
  const normalizedBizKey = String(bizKey || '').trim()
  const normalizedBizName = useMemo(() => {
    const matchedRule = effectiveUploadRules.find((item) => item.bizKey === normalizedBizKey)
    return String(matchedRule?.bizName || '').trim()
  }, [effectiveUploadRules, normalizedBizKey])
  const defaultSourceKey = initialScope === 'all' ? '' : normalizedBizKey
  const externalCategoryId = String(controlledCategoryId || '').trim()
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    kind: fixedKind ? defaultKind : '',
    keyword: '',
    fileType: '',
    sourceKey: defaultSourceKey,
    categoryId: externalCategoryId,
  })
  const [draft, setDraft] = useState<ResourceFilterDraft>({
    kind: fixedKind ? defaultKind : '',
    keyword: '',
    fileType: '',
    sourceKey: defaultSourceKey,
    categoryId: externalCategoryId,
  })
  const [uploadMessage, setUploadMessage] = useState('')
  const [progressText, setProgressText] = useState('')
  const [categorySavingID, setCategorySavingID] = useState('')
  const [batchCategoryValue, setBatchCategoryValue] = useState('')
  const [sourceVersion, setSourceVersion] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewInitialID, setPreviewInitialID] = useState<string | number | undefined>()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const effectiveKind = fixedKind ? defaultKind : filters.kind
  const { resources, total, loading, errorMessage } = useResourceList(
    filters,
    effectiveKind,
    refreshVersion
  )
  const totalPages = Math.max(1, Math.ceil(total / Math.max(filters.pageSize, 1)))
  const effectiveCardDensity =
    cardDensity || (selectionMode !== 'browse' && effectiveKind === 'image' ? 'compact' : 'default')
  const cardActionMode = selectionMode === 'browse' ? 'manager' : 'picker'
  const inputAccept = useMemo(() => resolveUploadInputAccept(effectiveUploadRules), [effectiveUploadRules])
  const uploadActionLabel = useMemo(
    () => resolveUploadActionLabel(effectiveUploadRules, effectiveKind || defaultKind),
    [defaultKind, effectiveKind, effectiveUploadRules]
  )
  const { categories, sources } = useResourceCatalog({
    sourceKey: filters.sourceKey,
    effectiveKind,
    normalizedBizKey,
    normalizedBizName,
    refreshVersion,
    sourceVersion,
  })
  const {
    canSelect,
    canBatchSelect,
    browseSelectedItems,
    setBrowseSelectedItems,
    handleSelectResource,
    isSelectedResource,
  } = useResourceSelection({
    resources,
    selectionMode,
    allowBatchSelect,
    selectedItems,
    maxSelection,
    onSelectedItemsChange,
  })

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      sourceKey: defaultSourceKey,
    }))
    setFilters((current) => ({
      ...current,
      page: 1,
      sourceKey: defaultSourceKey,
    }))
  }, [defaultSourceKey])

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      categoryId: externalCategoryId,
    }))
    setFilters((current) => ({
      ...current,
      page: 1,
      categoryId: externalCategoryId,
    }))
  }, [externalCategoryId])

  useEffect(() => {
    if (!fixedKind) {
      return
    }

    setDraft((current) => ({ ...current, kind: defaultKind }))
    setFilters((current) => ({ ...current, kind: defaultKind }))
  }, [defaultKind, fixedKind])

  const handleSearch = () => {
    setFilters((current) => ({
      ...current,
      page: 1,
      kind: fixedKind ? defaultKind : draft.kind,
      keyword: draft.keyword.trim(),
      fileType: draft.fileType.trim(),
      sourceKey: draft.sourceKey,
      categoryId: draft.categoryId,
    }))
  }

  const handleReset = () => {
    const nextDraft = {
      kind: fixedKind ? defaultKind : '',
      keyword: '',
      fileType: '',
      sourceKey: defaultSourceKey,
      categoryId: externalCategoryId,
    }

    setDraft(nextDraft)
    setFilters({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      ...nextDraft,
    })
  }

  const handleChooseUpload = () => {
    setUploadMessage('')
    inputRef.current?.click()
  }

  const handleUploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(event.target.files || [])
    event.target.value = ''
    if (effectiveUploadRules.length === 0 || fileList.length === 0) {
      return
    }

    setUploadMessage('')
    setProgressText('')

    try {
      const uploadedItems: UploadFileItem[] = []
      for (const current of fileList) {
        const matchedRule = resolveUploadRuleForFile(current, effectiveUploadRules, defaultKind)
        if (!matchedRule) {
          throw new Error(`未找到适合 ${current.name} 的上传规则`)
        }
        const rawUploadCategoryId =
          matchedRule.categoryId != null
            ? matchedRule.categoryId
            : externalCategoryId || filters.categoryId
        const uploadCategoryId = normalizeResourceCategoryId(
          rawUploadCategoryId
        )

        const uploaded = await uploadFileByRule(matchedRule.ruleId, current, {
          kind: matchedRule.kind || defaultKind,
          bizKey: matchedRule.bizKey || normalizedBizKey,
          bizName: matchedRule.bizName || normalizedBizName,
          categoryId: uploadCategoryId,
          onProgress: (loaded, totalSize) => {
            const percent = Math.min(100, Math.round((loaded / Math.max(totalSize, 1)) * 100))
            setProgressText(`${current.name} ${percent}%`)
          },
        })
        uploadedItems.push(uploaded)
      }

      if (canSelect) {
        const nextItems =
          selectionMode === 'single'
            ? uploadedItems.slice(-1)
            : mergeSelectedItems(selectedItems, uploadedItems).slice(0, maxSelection)
        onSelectedItemsChange?.(nextItems)
      }

      setFilters((current) => ({ ...current, page: 1 }))
      setSourceVersion((current) => current + 1)
      setUploadMessage(`已上传 ${uploadedItems.length} 个资源。`)
      onChanged?.()
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : '上传资源失败')
    } finally {
      setProgressText('')
    }
  }

  const handleAssignCategory = async (item: UploadFileItem, categoryId: string) => {
    setCategorySavingID(String(item.id))
    setUploadMessage('')

    try {
      await assignResourceCategory(item.id, categoryId)
      setUploadMessage('资源分类已更新。')
      setFilters((current) => ({ ...current }))
      onChanged?.()
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : '更新资源分类失败')
    } finally {
      setCategorySavingID('')
    }
  }

  const handlePreview = (item: UploadFileItem) => {
    setPreviewInitialID(item.id)
    setPreviewOpen(true)
  }

  const handleBatchAssignCategory = async (nextCategoryId: string) => {
    const normalizedCategoryId =
      nextCategoryId === UNCATEGORIZED_RESOURCE_CATEGORY ? '' : String(nextCategoryId || '').trim()
    if (browseSelectedItems.length === 0) {
      setBatchCategoryValue('')
      return
    }

    setBatchCategoryValue(nextCategoryId)
    setCategorySavingID('__batch__')
    setUploadMessage('')
    try {
      await assignResourceCategories(
        browseSelectedItems.map((item) => item.id),
        normalizedCategoryId
      )
      setUploadMessage(`已更新 ${browseSelectedItems.length} 个资源的分类。`)
      setBrowseSelectedItems([])
      setBatchCategoryValue('')
      setFilters((current) => ({ ...current }))
      onChanged?.()
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : '批量更新资源分类失败')
    } finally {
      setCategorySavingID('')
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={selectionMode !== 'single'}
        accept={inputAccept}
        onChange={handleUploadFiles}
      />

      <ResourceFilters
        fixedKind={fixedKind}
        hideCategoryFilter={hideCategoryFilter}
        draft={draft}
        categories={categories}
        sources={sources}
        onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          allowUpload && effectiveUploadRules.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleChooseUpload}
            >
              <Upload className="size-4" />
              {uploadActionLabel}
            </Button>
          ) : allowUpload ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="size-4" />
              当前入口仅浏览资源
            </div>
          ) : null
        }
      />

      {progressText ? <p className="text-xs text-muted-foreground">{progressText}</p> : null}
      {uploadMessage ? <p className="text-xs text-muted-foreground">{uploadMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {canSelect ? (
        <div className="text-sm text-muted-foreground">
          已选择 {selectedItems.length} 个资源
          {selectionMode === 'multiple' ? ` / 最多 ${maxSelection} 个` : ''}
        </div>
      ) : null}

      {canBatchSelect ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 px-4 py-3">
          <div className="text-sm text-muted-foreground">
            已选中 {browseSelectedItems.length} 个资源
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBrowseSelectedItems(resources)}
              disabled={resources.length === 0}
            >
              选中当前页
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBrowseSelectedItems([])}
              disabled={browseSelectedItems.length === 0}
            >
              清空选择
            </Button>
            <div className="w-[180px]">
              <Select
                value={batchCategoryValue || undefined}
                onValueChange={(value) => void handleBatchAssignCategory(value)}
                disabled={browseSelectedItems.length === 0 || categorySavingID === '__batch__'}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="批量设分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNCATEGORIZED_RESOURCE_CATEGORY}>设为未分类</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-4',
          effectiveCardDensity === 'compact'
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
            : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
        )}
      >
        {resources.map((item) => (
          <ResourceCard
            key={String(item.id)}
            item={item}
            selected={isSelectedResource(item)}
            selectable={canSelect || canBatchSelect}
            density={effectiveCardDensity}
            actionMode={cardActionMode}
            categories={categories}
            allowCategoryAssign={allowCategoryAssign}
            categoryUpdating={
              categorySavingID === '__batch__' || categorySavingID === String(item.id)
            }
            onSelect={handleSelectResource}
            onPreview={handlePreview}
            onCategoryChange={handleAssignCategory}
          />
        ))}
      </div>

      {!loading && resources.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          资源加载中...
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
        <span>
          第 {filters.page} / {totalPages} 页，共 {total} 条
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={filters.page <= 1}
            onClick={() =>
              setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))
            }
          >
            上一页
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={filters.page >= totalPages}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: Math.min(totalPages, current.page + 1),
              }))
            }
          >
            下一页
          </Button>
        </div>
      </div>

      <ResourcePreviewDialogLazy
        open={previewOpen}
        title="资源预览"
        description="可查看当前筛选结果中的图片、视频和音频资源。"
        items={resources}
        initialItemId={previewInitialID}
        onOpenChange={setPreviewOpen}
      />
    </div>
  )
}

function mergeSelectedItems(currentItems: UploadFileItem[], nextItems: UploadFileItem[]) {
  const merged = [...currentItems]
  for (const current of nextItems) {
    if (merged.some((item) => isSameUploadSelectionItem(item, current))) {
      continue
    }
    merged.push(current)
  }
  return merged
}

function resolveUploadInputAccept(rules: ResourceUploadRule[]) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return undefined
  }

  const accepts = Array.from(
    new Set(
      rules
        .map((item) => String(item.accept || '').trim())
        .filter(Boolean)
    )
  )

  if (accepts.length === 0 || accepts.length !== rules.length) {
    return undefined
  }

  return accepts.join(',')
}

function resolveUploadRuleForFile(
  file: File,
  rules: ResourceUploadRule[],
  defaultKind: string
) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return null
  }
  if (rules.length === 1) {
    return rules[0]
  }

  const fileKind = resolveFileKind(file)
  const exactRule = rules.find((item) => resolveUploadRuleKind(item, defaultKind) === fileKind)
  if (exactRule) {
    return exactRule
  }

  const genericRule = rules.find((item) => resolveUploadRuleKind(item, defaultKind) === 'file')
  return genericRule || rules[0]
}

function resolveUploadRuleKind(rule: ResourceUploadRule, defaultKind: string) {
  const normalizedKind = String(rule.kind || defaultKind || 'file').trim().toLowerCase()
  if (['image', 'video', 'audio', 'file', 'other'].includes(normalizedKind)) {
    return normalizedKind
  }
  return 'file'
}

function resolveFileKind(file: File) {
  const mime = String(file.type || '').trim().toLowerCase()
  if (mime.startsWith('image/')) {
    return 'image'
  }
  if (mime.startsWith('video/')) {
    return 'video'
  }
  if (mime.startsWith('audio/')) {
    return 'audio'
  }

  const name = String(file.name || '').trim().toLowerCase()
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)) {
    return 'image'
  }
  if (/\.(mp4|mov|avi|mkv|webm)$/.test(name)) {
    return 'video'
  }
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(name)) {
    return 'audio'
  }

  return 'file'
}
