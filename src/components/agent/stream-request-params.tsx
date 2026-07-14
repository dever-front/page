import { useRef, useState, type ChangeEvent } from 'react'
import {
  Check,
  FolderOpen,
  Loader2,
  Paperclip,
  X,
} from 'lucide-react'
import { findFloatingLayerContainer } from '@/lib/floating-layer'
import { resolveAssetUrl } from '@/lib/request'
import {
  formatUploadSize,
  resolveResourceKind,
  type ResourceUploadRule,
} from '@/lib/resource'
import {
  uploadFileByRule,
  type UploadFileItem,
  type UploadRuleMeta,
} from '@/lib/upload'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ResourcePickerDialogLazy } from '@/components/resource/lazy-dialogs'
import { useResourcePreviewDialog } from '@/components/resource/use-resource-preview'
import { SearchableOptionPicker } from '@/components/searchable-option-picker'
import { PowerParamIcon } from './power-param-icon'

const PARAM_USAGE_MAIN = 1
const PARAM_USAGE_TOOLBAR = 2
const INLINE_OPTION_LIMIT = 5
const DEFAULT_MAX_FILES = 5

export type PowerParamOption = {
  id: string | number
  name?: string
  value: string
  native_value?: string
  sort?: number
}

export type PowerParam = {
  id: string | number
  power_param_id?: string | number
  name: string
  key?: string
  icon?: string
  type: string
  usage: number
  value_type: string
  default_value?: string
  placeholder?: string
  required?: boolean
  upload_rule_id?: string | number
  max_files?: number
  sort?: number
  options?: PowerParamOption[]
}

export type ParamValueMap = Record<string, unknown>
export type ParamUploadedFile = UploadFileItem
export type ParamFileMap = Record<string, ParamUploadedFile[]>

export type PowerParamSource = {
  id: string
  target_id?: string
  name: string
  service_name?: string
  provider_name?: string
}

export type PowerParamConfig = {
  sourceRule: number
  selectedSourceID: string
  sources: PowerParamSource[]
  params: PowerParam[]
}

type ParamControlSurface = 'main' | 'toolbar'

type ParamControlProps = {
  param: PowerParam
  value: unknown
  files: ParamUploadedFile[]
  uploadRuleMeta?: UploadRuleMeta
  disabled?: boolean
  surface: ParamControlSurface
  onChange: (nextValue: unknown) => void
  onFilesChange: (nextFiles: ParamUploadedFile[]) => void
  onClose?: () => void
}

export function PowerParamField(props: Omit<ParamControlProps, 'surface'>) {
  const { param, value } = props
  if (isHiddenParam(param)) {
    return null
  }
  if (isDescriptionParam(param)) {
    return <PowerParamDescription param={param} surface='main' />
  }

  const currentValue = displayParamValue(param, value)
  const label = paramLabel(param)

  return (
    <div className='space-y-2 rounded-xl bg-muted/30 p-3'>
      <Label className='text-sm font-medium text-foreground'>
        {label}
        {isRequiredParam(param) ? (
          <span className='ml-0.5 text-destructive'>*</span>
        ) : null}
      </Label>
      <PowerParamControl {...props} value={currentValue} surface='main' />
    </div>
  )
}

export function PowerParamPopover({
  triggerClassName,
  ...props
}: Omit<ParamControlProps, 'surface'> & { triggerClassName?: string }) {
  const { param, value, files, disabled } = props
  const [open, setOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const currentValue = displayParamValue(param, value)
  const label = paramLabel(param)
  const summary = paramSummary(param, currentValue, files)
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPortalContainer(findFloatingLayerContainer(triggerRef.current))
    }
    setOpen(nextOpen)
  }

  if (isDescriptionParam(param)) {
    return <PowerParamDescription param={param} surface='toolbar' />
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled}
          className={cn(
            'w-[10.5rem] justify-start gap-1.5 px-2.5',
            triggerClassName
          )}
          title={`${label}${summary ? `：${summary}` : ''}`}
        >
          <PowerParamIcon
            name={param.icon}
            className='size-3.5 shrink-0'
          />
          <span className='truncate'>{label}</span>
          {isRequiredParam(param) ? (
            <span className='-ml-1 text-destructive'>*</span>
          ) : null}
          {summary ? (
            <span className='max-w-[5rem] truncate text-xs text-muted-foreground'>
              {summary}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        container={portalContainer}
        className='z-[120] w-80 space-y-3'
      >
        <p className='min-w-0 truncate text-sm font-medium'>
          {label}
          {isRequiredParam(param) ? (
            <span className='ml-0.5 text-destructive'>*</span>
          ) : null}
        </p>
        <PowerParamControl
          {...props}
          value={currentValue}
          surface='toolbar'
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

function PowerParamControl({
  param,
  value,
  files,
  uploadRuleMeta,
  disabled,
  surface,
  onChange,
  onFilesChange,
  onClose,
}: ParamControlProps) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const label = paramLabel(param)
  const resourceRule = resolveParamResourceRule(param, uploadRuleMeta)
  const { openPreview, previewDialog, hasItems } = useResourcePreviewDialog(
    files,
    {
      title: `${label}详情`,
      description: '可查看当前上传资源详情；不支持在线预览的文件可直接下载。',
    }
  )

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    if (selected.length === 0) {
      return
    }

    const ruleId = Number(param.upload_rule_id || 0)
    if (!Number.isFinite(ruleId) || ruleId <= 0) {
      setMessage('未配置上传规则。')
      return
    }

    const multiple = isFilesParam(param)
    const maxFiles = resolveMaxFiles(param)
    const remaining = multiple ? Math.max(maxFiles - files.length, 0) : 1
    if (remaining <= 0) {
      setMessage(`最多只能上传 ${maxFiles} 个文件。`)
      return
    }

    setUploading(true)
    setMessage('')
    try {
      let nextFiles = multiple ? [...files] : []
      for (const file of multiple
        ? selected.slice(0, remaining)
        : selected.slice(0, 1)) {
        const uploaded = await uploadFileByRule(ruleId, file, {
          kind: resourceRule?.kind || resolveFileResourceKind(file),
          transport: resourceRule?.transport,
        })
        nextFiles = multiple ? [...nextFiles, uploaded] : [uploaded]
      }
      onFilesChange(nextFiles)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败。')
    } finally {
      setUploading(false)
    }
  }

  const handlePreviewFile = (targetID?: ParamUploadedFile['id']) => {
    onClose?.()
    openPreview(targetID)
  }

  const handlePickResources = (selectedFiles: ParamUploadedFile[]) => {
    const maxFiles = resolveMaxFiles(param)
    const nextFiles = (
      isFilesParam(param) ? selectedFiles : selectedFiles.slice(0, 1)
    ).slice(0, maxFiles)
    setMessage('')
    onFilesChange(nextFiles)
  }

  if (isHiddenParam(param) || isDisplayOnlyParam(param)) {
    return null
  }

  return (
    <>
      {renderParamControl({
        param,
        value,
        files,
        uploading,
        disabled: !!disabled,
        surface,
        onChange,
        onClose,
        onPickFiles: () => fileInputRef.current?.click(),
        onPickResources: () => setPickerOpen(true),
        onPreviewFile: handlePreviewFile,
        onRemoveFile: (targetID) =>
          onFilesChange(
            files.filter((file) => String(file.id) !== String(targetID))
          ),
        canPickResources: !!resourceRule,
      })}

      {isFileParam(param) ? (
        <input
          ref={fileInputRef}
          type='file'
          className='hidden'
          multiple={isFilesParam(param)}
          accept={uploadRuleMeta?.accept}
          onChange={handleUpload}
        />
      ) : null}

      {message ? <p className='text-xs text-destructive'>{message}</p> : null}
      {resourceRule ? (
        <ResourcePickerDialogLazy
          open={pickerOpen}
          title={`${label}资源库`}
          description='可从资源库选择匹配当前上传规则的资源。'
          initialScope='all'
          defaultKind={resourceRule.kind}
          fixedKind={Boolean(resourceRule.kind)}
          value={files}
          multiple={isFilesParam(param)}
          maxSelection={resolveMaxFiles(param)}
          emptyText='暂无匹配资源。'
          uploadRules={[resourceRule]}
          onOpenChange={setPickerOpen}
          onConfirm={handlePickResources}
        />
      ) : null}
      {isFileParam(param) && hasItems ? previewDialog : null}
    </>
  )
}

function renderParamControl({
  param,
  value,
  files,
  uploading,
  disabled,
  surface,
  onChange,
  onClose,
  onPickFiles,
  onPickResources,
  onPreviewFile,
  onRemoveFile,
  canPickResources,
}: {
  param: PowerParam
  value: unknown
  files: ParamUploadedFile[]
  uploading: boolean
  disabled: boolean
  surface: ParamControlSurface
  onChange: (nextValue: unknown) => void
  onClose?: () => void
  onPickFiles: () => void
  onPickResources: () => void
  onPreviewFile: (targetID?: ParamUploadedFile['id']) => void
  onRemoveFile: (targetID: ParamUploadedFile['id']) => void
  canPickResources?: boolean
}) {
  switch (normalizeParamType(param.type)) {
    case 'description':
      return <PowerParamDescription param={param} surface={surface} />
    case 'textarea':
      return (
        <Textarea
          value={value == null ? '' : String(value)}
          placeholder={paramInputPlaceholder(param)}
          disabled={disabled}
          rows={surface === 'main' ? 4 : 3}
          className={cn(
            'resize-y',
            surface === 'main' && 'min-h-24 rounded-xl'
          )}
          onChange={(event) => onChange(event.target.value)}
        />
      )
    case 'switch':
      return (
        <div className='flex items-center justify-between rounded-lg border px-3 py-2'>
          <Label className='text-sm font-normal'>启用</Label>
          <Switch
            checked={isTruthyValue(value)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      )
    case 'option':
      return (
        <SingleOptionControl
          param={param}
          value={value}
          disabled={disabled}
          surface={surface}
          onChange={onChange}
          onClose={onClose}
        />
      )
    case 'multi_option':
      return (
        <MultiOptionControl
          param={param}
          value={value}
          disabled={disabled}
          surface={surface}
          onChange={onChange}
        />
      )
    case 'file':
    case 'files':
      return (
        <FileParamControl
          param={param}
          files={files}
          uploading={uploading}
          disabled={disabled}
          canPickResources={!!canPickResources}
          onPickFiles={onPickFiles}
          onPickResources={onPickResources}
          onPreviewFile={onPreviewFile}
          onRemoveFile={onRemoveFile}
        />
      )
    default:
      return (
        <Input
          value={value == null ? '' : String(value)}
          placeholder={paramInputPlaceholder(param)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }
}

function SingleOptionControl({
  param,
  value,
  disabled,
  surface,
  onChange,
  onClose,
}: {
  param: PowerParam
  value: unknown
  disabled: boolean
  surface: ParamControlSurface
  onChange: (nextValue: unknown) => void
  onClose?: () => void
}) {
  const options = param.options || []
  const selected = value == null ? '' : String(value)

  if (options.length === 0) {
    return <p className='text-xs text-muted-foreground'>暂无可选项。</p>
  }

  if (surface === 'main' && options.length <= INLINE_OPTION_LIMIT) {
    return (
      <RadioGroup
        value={selected}
        disabled={disabled}
        onValueChange={(nextValue) => onChange(nextValue)}
        className='flex flex-wrap items-center gap-x-6 gap-y-2'
      >
        {options.map((option) => {
          const optionValue = optionRequestValue(option)
          const optionID = String(option.id)
          return (
            <Label
              key={optionID}
              htmlFor={`${param.id}-${optionID}`}
              className='flex min-w-0 cursor-pointer items-start gap-2.5 font-normal'
            >
              <RadioGroupItem
                value={optionValue}
                id={`${param.id}-${optionID}`}
              />
              <span className='min-w-0 leading-5 break-words'>
                {option.value}
              </span>
            </Label>
          )
        })}
      </RadioGroup>
    )
  }

  if (surface === 'main') {
    return (
      <SearchableOptionPicker
        value={selected || undefined}
        options={optionPickerOptions(options)}
        disabled={disabled}
        placeholder='请选择'
        clearable={false}
        onChange={(nextValue) =>
          onChange(Array.isArray(nextValue) ? nextValue[0] || '' : nextValue)
        }
      />
    )
  }

  return (
    <div className='max-h-56 space-y-1 overflow-y-auto pr-1'>
      {options.map((option) => {
        const optionID = String(option.id)
        const optionValue = optionRequestValue(option)
        const checked = isSelectedOptionValue(option, [selected])
        return (
          <Button
            key={optionID}
            type='button'
            variant='ghost'
            disabled={disabled}
            className='h-8 w-full justify-start gap-2 px-2 font-normal'
            onClick={() => {
              onChange(optionValue)
              onClose?.()
            }}
          >
            <span className='min-w-0 flex-1 truncate text-left'>
              {option.value}
            </span>
            <Check
              className={cn(
                'size-4',
                checked ? 'text-primary opacity-100' : 'opacity-0'
              )}
            />
          </Button>
        )
      })}
    </div>
  )
}

function MultiOptionControl({
  param,
  value,
  disabled,
  surface,
  onChange,
}: {
  param: PowerParam
  value: unknown
  disabled: boolean
  surface: ParamControlSurface
  onChange: (nextValue: unknown) => void
}) {
  const options = param.options || []
  const selected = normalizeStringArray(value)

  if (options.length === 0) {
    return <p className='text-xs text-muted-foreground'>暂无可选项。</p>
  }

  if (surface === 'main' && options.length > INLINE_OPTION_LIMIT) {
    return (
      <SearchableOptionPicker
        multiple
        value={selected}
        options={optionPickerOptions(options)}
        disabled={disabled}
        placeholder='请选择'
        onChange={onChange}
      />
    )
  }

  return (
    <div
      className={cn(
        surface === 'main'
          ? 'flex flex-wrap gap-x-5 gap-y-2'
          : 'max-h-56 space-y-2 overflow-y-auto pr-1'
      )}
    >
      {options.map((option) => {
        const optionID = String(option.id)
        const optionValue = optionRequestValue(option)
        const checked = isSelectedOptionValue(option, selected)
        return (
          <label
            key={optionID}
            className={cn(
              'flex min-w-0 cursor-pointer items-start gap-2 text-sm',
              surface === 'toolbar' &&
                'rounded-md px-1 py-1.5 hover:bg-muted/60'
            )}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(nextChecked) => {
                if (nextChecked) {
                  onChange(Array.from(new Set([...selected, optionValue])))
                  return
                }
                onChange(
                  selected.filter(
                    (current) => !isSelectedOptionValue(option, [current])
                  )
                )
              }}
            />
            <span
              className={cn(
                'min-w-0 flex-1 break-words',
                surface === 'toolbar' && 'truncate'
              )}
            >
              {option.value}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function FileParamControl({
  param,
  files,
  uploading,
  disabled,
  canPickResources,
  onPickFiles,
  onPickResources,
  onPreviewFile,
  onRemoveFile,
}: {
  param: PowerParam
  files: ParamUploadedFile[]
  uploading: boolean
  disabled: boolean
  canPickResources: boolean
  onPickFiles: () => void
  onPickResources: () => void
  onPreviewFile: (targetID?: ParamUploadedFile['id']) => void
  onRemoveFile: (targetID: ParamUploadedFile['id']) => void
}) {
  const maxFiles = resolveMaxFiles(param)
  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled || uploading || files.length >= maxFiles}
            onClick={onPickFiles}
          >
            {uploading ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Paperclip className='size-4' />
            )}
            {uploading ? '上传中...' : '选择文件'}
          </Button>
          {canPickResources ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={disabled || uploading}
              onClick={onPickResources}
            >
              <FolderOpen className='size-4' />
              资源库
            </Button>
          ) : null}
        </div>
        <span className='text-xs text-muted-foreground'>
          {files.length}/{maxFiles}
        </span>
      </div>

      {files.length > 0 ? (
        <div className='space-y-1.5'>
          {files.map((file) => (
            <div
              key={String(file.id)}
              className='flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs'
            >
              <button
                type='button'
                className='min-w-0 flex-1 truncate text-left text-foreground underline-offset-2 transition hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none'
                title={file.name || '文件资源'}
                onClick={() => onPreviewFile(file.id)}
              >
                {file.name || '文件资源'}
              </button>
              <span className='shrink-0 text-muted-foreground'>
                {formatUploadSize(Number(file.size || 0))}
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                disabled={disabled}
                className='size-6 shrink-0 text-muted-foreground hover:text-destructive'
                onClick={() => onRemoveFile(file.id)}
              >
                <X className='size-3.5' />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function resolveParamResourceRule(
  param: PowerParam,
  uploadRuleMeta?: UploadRuleMeta
): ResourceUploadRule | undefined {
  const ruleId = Number(param.upload_rule_id || 0)
  if (!isFileParam(param) || !Number.isFinite(ruleId) || ruleId <= 0) {
    return undefined
  }

  const accept = String(uploadRuleMeta?.accept || '').trim()
  const kind = resolveAcceptResourceKind(accept)

  return {
    ruleId,
    accept: accept || undefined,
    kind: kind || undefined,
    transport: String(uploadRuleMeta?.transport || '').trim() || undefined,
  }
}

function resolveAcceptResourceKind(accept: string) {
  const normalized = String(accept || '')
    .trim()
    .toLowerCase()
  if (!normalized) {
    return ''
  }
  const tokens = normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (
    tokens.some(
      (item) => item.startsWith('image/') || imageAcceptExtensions.has(item)
    )
  ) {
    return 'image'
  }
  if (
    tokens.some(
      (item) => item.startsWith('video/') || videoAcceptExtensions.has(item)
    )
  ) {
    return 'video'
  }
  if (
    tokens.some(
      (item) => item.startsWith('audio/') || audioAcceptExtensions.has(item)
    )
  ) {
    return 'audio'
  }
  return resolveResourceKind({ accept: normalized })
}

function resolveFileResourceKind(file: File) {
  const mime = String(file.type || '').toLowerCase()
  if (mime.startsWith('image/')) {
    return 'image'
  }
  if (mime.startsWith('video/')) {
    return 'video'
  }
  if (mime.startsWith('audio/')) {
    return 'audio'
  }
  return 'file'
}

const imageAcceptExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
])

const videoAcceptExtensions = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv'])

const audioAcceptExtensions = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
])

function PowerParamDescription({
  param,
  surface,
}: {
  param: PowerParam
  surface: ParamControlSurface
}) {
  const label = paramLabel(param)
  const description = String(param.default_value || '').trim()

  if (surface === 'toolbar') {
    return (
      <div
        className='flex min-h-9 max-w-full items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm'
        title={description || label}
      >
        <span className='shrink-0 font-medium text-foreground'>{label}</span>
        {description ? (
          <span className='min-w-0 truncate text-muted-foreground'>
            {description}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className='space-y-1.5 rounded-xl border border-dashed bg-muted/20 p-3'>
      <Label className='text-sm font-medium text-foreground'>{label}</Label>
      <p className='text-sm leading-6 whitespace-pre-wrap text-muted-foreground'>
        {description || '暂无说明。'}
      </p>
    </div>
  )
}

export function normalizePowerParams(value: unknown): PowerParam[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((row) => normalizePowerParam(row))
    .filter((row): row is PowerParam => row != null)
    .sort((left, right) => {
      const leftSort = Number(left.sort || 0)
      const rightSort = Number(right.sort || 0)
      if (leftSort !== rightSort) {
        return leftSort - rightSort
      }
      return Number(left.id || 0) - Number(right.id || 0)
    })
}

export function normalizePowerParamConfig(value: unknown): PowerParamConfig {
  if (Array.isArray(value)) {
    return {
      sourceRule: 1,
      selectedSourceID: '',
      sources: [],
      params: normalizePowerParams(value),
    }
  }

  if (!isPlainObject(value)) {
    return {
      sourceRule: 1,
      selectedSourceID: '',
      sources: [],
      params: [],
    }
  }

  return {
    sourceRule: Number(value.source_rule || 1),
    selectedSourceID: valueText(value.selected_target_id),
    sources: normalizePowerParamSources(value.sources),
    params: normalizePowerParams(value.params),
  }
}

function normalizePowerParamSources(value: unknown): PowerParamSource[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((row) => {
      if (!isPlainObject(row)) {
        return null
      }
      const id = valueText(row.target_id || row.id)
      if (!id) {
        return null
      }
      const serviceName = valueText(row.service_name)
      const providerName = valueText(row.provider_name)
      return {
        id,
        target_id: id,
        service_name: serviceName,
        provider_name: providerName,
        name:
          valueText(row.name) ||
          [providerName, serviceName].filter(Boolean).join(' / ') ||
          `来源 ${id}`,
      }
    })
    .filter((row): row is PowerParamSource => row != null)
}

export function buildDefaultParamValues(params: PowerParam[]): ParamValueMap {
  const result: ParamValueMap = {}
  for (const param of params) {
    if (isDisplayOnlyParam(param)) {
      continue
    }
    const key = inputKeyForParam(param)
    if (!key) {
      continue
    }
    const value = parseClientDefaultValue(param)
    if (!isParamValueMissing(param, value)) {
      result[key] = value
    }
  }
  return result
}

export function buildRequestInput(
  params: PowerParam[],
  values: ParamValueMap
): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  for (const param of params) {
    if (isDisplayOnlyParam(param)) {
      continue
    }
    const key = inputKeyForParam(param)
    if (!key) {
      continue
    }

    const value = normalizeParamRequestValue(param, values[key])
    if (!isParamValueMissing(param, value)) {
      input[key] = value
    }
  }
  return input
}

export function validateMainParams(
  params: PowerParam[],
  values: ParamValueMap
) {
  for (const param of params) {
    if (!isRequiredParam(param) || isDisplayOnlyParam(param)) {
      continue
    }
    const key = inputKeyForParam(param)
    const value = normalizeParamRequestValue(param, values[key])
    if (!key || isParamValueMissing(param, value)) {
      return `请填写参数“${paramLabel(param)}”。`
    }
  }
  return ''
}

export function paramFilesRequestValue(
  param: PowerParam,
  files: ParamUploadedFile[]
) {
  const values = files.map(uploadFileRequestValue).filter(Boolean)
  if (isFilesParam(param)) {
    return values
  }
  return values[0] || ''
}

export function summarizeParamDisplayValue(param: PowerParam, value: unknown) {
  if (isFileParam(param)) {
    const files = normalizeStringArray(value)
    if (files.length === 0) {
      return '空'
    }
    return files.length === 1 ? files[0] : `${files.length} 个文件`
  }
  if (normalizeParamType(param.type) === 'switch') {
    return isTruthyValue(value) ? '是' : '否'
  }
  if (normalizeParamType(param.type) === 'option') {
    return (
      optionDisplayLabels(
        param.options || [],
        normalizeStringArray(value)
      ).join(' / ') || '空'
    )
  }
  if (normalizeParamType(param.type) === 'multi_option') {
    return (
      optionDisplayLabels(
        param.options || [],
        normalizeStringArray(value)
      ).join(' / ') || '空'
    )
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join('、') : '空'
  }
  if (isPlainObject(value)) {
    return JSON.stringify(value)
  }
  return valueText(value) || '空'
}

export function inputKeyForParam(param: PowerParam) {
  return (
    String(param.key || '').trim() ||
    String(param.name || '').trim() ||
    String(param.id || '').trim()
  )
}

export function isMainParam(param: PowerParam) {
  return Number(param.usage || PARAM_USAGE_MAIN) === PARAM_USAGE_MAIN
}

export function isToolbarParam(param: PowerParam) {
  return Number(param.usage || PARAM_USAGE_MAIN) === PARAM_USAGE_TOOLBAR
}

export function isHiddenParam(param: PowerParam) {
  return normalizeParamType(param.type) === 'hidden'
}

function isDescriptionParam(param: PowerParam) {
  return normalizeParamType(param.type) === 'description'
}

function isDisplayOnlyParam(param: PowerParam) {
  return isDescriptionParam(param)
}

function normalizePowerParam(row: unknown): PowerParam | null {
  if (!isPlainObject(row)) {
    return null
  }
  const id = row.id
  if (id == null || id === '') {
    return null
  }
  const options = Array.isArray(row.options)
    ? row.options
        .filter(isPlainObject)
        .map((option) => ({
          id: option.id,
          name: valueText(option.name),
          value: valueText(option.value || option.name || option.id),
          native_value: valueText(option.native_value),
          sort: Number(option.sort || 0),
        }))
        .filter((option) => option.id != null && option.id !== '')
    : []

  return {
    id,
    power_param_id: row.power_param_id,
    name: valueText(row.name),
    key: valueText(row.key),
    icon: valueText(row.icon),
    type: normalizeParamType(row.type),
    usage: normalizeParamUsage(row.usage),
    value_type: normalizeValueType(row.value_type),
    default_value: valueText(row.default_value),
    placeholder: valueText(row.placeholder),
    required: normalizeRequiredFlag(row.required),
    upload_rule_id: row.upload_rule_id,
    max_files: Number(row.max_files || 0),
    sort: Number(row.sort || 0),
    options,
  }
}

function parseClientDefaultValue(param: PowerParam) {
  const value = String(param.default_value || '').trim()
  if (!value) {
    return missingDefaultParamValue(param)
  }

  switch (normalizeParamType(param.type)) {
    case 'switch':
      return convertSwitchValueByType(param, value)
    case 'option':
      return optionDefaultValue(param, value)
    case 'multi_option':
      try {
        const parsed = JSON.parse(value)
        return optionRequestValues(
          param,
          Array.isArray(parsed) ? parsed : [parsed]
        )
      } catch {
        return optionRequestValues(param, [value])
      }
    case 'files':
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        return [value]
      }
    default:
      return convertValueByType(param, value)
  }
}

function firstOptionRequestValue(param: PowerParam) {
  const firstOption = param.options?.[0]
  return firstOption ? optionRequestValue(firstOption) : undefined
}

function optionDefaultValue(param: PowerParam, value: string) {
  const options = param.options || []
  if (options.length === 0) {
    return value || undefined
  }
  const matched = options.find((option) =>
    isSelectedOptionValue(option, [value])
  )
  return optionRequestValue(matched || options[0])
}

function normalizeParamRequestValue(param: PowerParam, value: unknown) {
  if (isParamValueMissing(param, value)) {
    return missingDefaultParamValue(param) ?? value
  }

  switch (normalizeParamType(param.type)) {
    case 'switch':
      return convertSwitchValueByType(param, value)
    case 'option':
      return convertValueByType(
        param,
        optionRequestValues(param, value)[0] || value
      )
    case 'multi_option':
      return optionRequestValues(param, value).map((item) =>
        convertValueByType(param, item)
      )
    case 'files':
      return normalizeStringArray(value)
    case 'file':
      return normalizeStringArray(value)[0] || ''
    default:
      return convertValueByType(param, value)
  }
}

function displayParamValue(param: PowerParam, value: unknown) {
  if (!isParamValueMissing(param, value)) {
    return value
  }
  return missingDefaultParamValue(param) ?? value
}

function missingDefaultParamValue(param: PowerParam) {
  switch (normalizeParamType(param.type)) {
    case 'option':
      return firstOptionRequestValue(param)
    case 'switch':
      return false
    default:
      return undefined
  }
}

function isParamValueMissing(param: PowerParam, value: unknown) {
  if (isFileParam(param)) {
    return normalizeStringArray(value).length === 0
  }
  if (normalizeParamType(param.type) === 'switch') {
    return isToolbarParam(param) && (value == null || value === '')
  }
  if (value == null) {
    return true
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  if (typeof value === 'string') {
    return value.trim() === ''
  }
  return false
}

function isRequiredParam(param: PowerParam) {
  return param.required !== false
}

function normalizeRequiredFlag(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }
  if (value == null || value === '') {
    return true
  }
  const text = String(value).trim().toLowerCase()
  return text !== '0' && text !== 'false' && text !== '2' && text !== 'optional'
}

function uploadFileRequestValue(file: ParamUploadedFile) {
  for (const value of [
    file.url,
    file.thumbnail,
    file.download,
    file.open_url,
    file.path,
  ]) {
    const url = resolveAssetUrl(String(value || '').trim())
    if (url) {
      return url
    }
  }
  return ''
}

function paramSummary(
  param: PowerParam,
  value: unknown,
  files: ParamUploadedFile[]
) {
  if (isFileParam(param)) {
    if (files.length === 0) {
      return ''
    }
    if (files.length === 1) {
      return files[0]?.name || '1 个文件'
    }
    return `${files.length} 个文件`
  }
  if (normalizeParamType(param.type) === 'switch') {
    return isTruthyValue(value) ? '是' : '否'
  }
  if (normalizeParamType(param.type) === 'option') {
    return optionLabels(param.options || [], normalizeStringArray(value)).join(
      ' / '
    )
  }
  if (normalizeParamType(param.type) === 'multi_option') {
    return optionLabels(param.options || [], normalizeStringArray(value)).join(
      ' / '
    )
  }
  return truncateText(valueText(value), 18)
}

function optionLabels(options: PowerParamOption[], selectedValues: string[]) {
  return optionDisplayLabels(options, selectedValues, false)
}

function optionDisplayLabels(
  options: PowerParamOption[],
  selectedValues: string[],
  fallbackToRaw = true
) {
  if (selectedValues.length === 0) {
    return []
  }
  return selectedValues
    .map((value) => {
      const option = options.find((current) =>
        isSelectedOptionValue(current, [value])
      )
      return option?.value || (fallbackToRaw ? String(value).trim() : '')
    })
    .filter((label) => label !== '')
}

function optionRequestValues(param: PowerParam, value: unknown) {
  const options = param.options || []
  return normalizeStringArray(value).map((current) => {
    const option = options.find((candidate) =>
      isSelectedOptionValue(candidate, [current])
    )
    return option ? optionRequestValue(option) : current
  })
}

export function optionRequestValue(option: PowerParamOption) {
  return (
    String(option.native_value || '').trim() ||
    String(option.value || '').trim() ||
    String(option.name || '').trim() ||
    String(option.id)
  )
}

function optionPickerOptions(options: PowerParamOption[]) {
  return options.map((option) => ({
    id: optionRequestValue(option),
    value: option.value,
  }))
}

export function isSelectedOptionValue(
  option: PowerParamOption,
  values: string[]
) {
  const candidates = [
    String(option.id),
    String(option.native_value || '').trim(),
    String(option.value || '').trim(),
    String(option.name || '').trim(),
  ].filter(Boolean)
  return values.some((value) => candidates.includes(String(value).trim()))
}

function paramLabel(param: PowerParam) {
  return String(param.name || param.key || param.id || '参数').trim()
}

function paramInputPlaceholder(param: PowerParam) {
  if (String(param.placeholder || '').trim()) {
    return String(param.placeholder || '').trim()
  }
  return `请输入${paramLabel(param)}`
}

function normalizeParamType(value: unknown) {
  const type = String(value || '')
    .trim()
    .toLowerCase()
  switch (type) {
    case 'text':
    case 'string':
      return 'textarea'
    case 'number':
      return 'input'
    case 'bool':
    case 'boolean':
      return 'switch'
    case 'textarea':
    case 'switch':
    case 'option':
    case 'multi_option':
    case 'file':
    case 'files':
    case 'hidden':
    case 'description':
      return type
    default:
      return 'input'
  }
}

function normalizeParamUsage(value: unknown) {
  return Number(value || PARAM_USAGE_MAIN) === PARAM_USAGE_TOOLBAR
    ? PARAM_USAGE_TOOLBAR
    : PARAM_USAGE_MAIN
}

function normalizeValueType(value: unknown) {
  const type = String(value || '')
    .trim()
    .toLowerCase()
  return ['number', 'int', 'integer', 'float', 'double'].includes(type)
    ? 'number'
    : 'string'
}

export function isFileParam(param: PowerParam) {
  const type = normalizeParamType(param.type)
  return type === 'file' || type === 'files'
}

export function isFilesParam(param: PowerParam) {
  return normalizeParamType(param.type) === 'files'
}

export function resolveMaxFiles(param: PowerParam) {
  if (isFilesParam(param)) {
    return Math.max(1, Number(param.max_files || DEFAULT_MAX_FILES))
  }
  return 1
}

function convertValueByType(param: PowerParam, value: unknown) {
  const text = valueText(value).trim()
  switch (normalizeValueType(param.value_type)) {
    case 'number': {
      const parsed = Number.parseFloat(text)
      return Number.isFinite(parsed) ? parsed : text
    }
    default:
      return text
  }
}

function convertSwitchValueByType(param: PowerParam, value: unknown) {
  const checked = isTruthyValue(value)
  return normalizeValueType(param.value_type) === 'string'
    ? String(checked)
    : checked
}

function isTruthyValue(value: unknown) {
  return (
    value === true ||
    value === 1 ||
    ['1', 'true', 'yes', 'y', 'on', '是', '启用'].includes(
      String(value).toLowerCase()
    )
  )
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((current) => String(current))
      .filter((current) => current.trim() !== '')
  }
  if (value == null || value === '') {
    return []
  }
  return [String(value)]
}

function truncateText(value: string, maxLength: number) {
  const text = String(value || '').trim()
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}...`
}

function valueText(value: unknown) {
  if (value == null) {
    return ''
  }
  return typeof value === 'string' ? value : String(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
