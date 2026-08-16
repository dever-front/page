import { useRef, useState, type ChangeEvent } from 'react'
import { AtSign, Hash, Loader2, Paperclip } from 'lucide-react'
import { findFloatingLayerContainer } from '@/lib/floating-layer'
import { resolveResourceKind } from '@/lib/resource'
import {
  uploadFileByRule,
  type UploadFileItem,
  type UploadRuleMeta,
} from '@/lib/upload'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  isFilesParam,
  resolveMaxFiles,
  resolveParamResourceRule,
  type ParamFileLibraryRenderer,
  type PowerParam,
} from '@/components/agent/stream-request-params'
import { PowerParamIcon } from '@/components/agent/power-param-icon'
import { ResourcePickerDialogLazy } from '@/components/resource/lazy-dialogs'
import { ReferenceComposerControlTooltip } from './tooltip'
import type { ReferenceOption } from './types'
import { uploadFileReferenceOptions } from './upload-reference'

export type ReferenceAttachmentAction = {
  trigger: string
  label: string
}

export function ReferenceFileParamButton({
  param,
  count,
  disabled,
  layerZIndex,
  uploadBizKey,
  uploadBizName,
  allowResourceLibrary = true,
  files,
  uploadRuleMeta,
  renderFileLibrary,
  fileLibraryIncludesUpload = false,
  onUploadedFiles,
  onReplace,
  onMessage,
}: {
  param: PowerParam
  count: number
  disabled?: boolean
  layerZIndex?: number
  uploadBizKey?: string
  uploadBizName?: string
  allowResourceLibrary?: boolean
  files: UploadFileItem[]
  uploadRuleMeta?: UploadRuleMeta
  renderFileLibrary?: ParamFileLibraryRenderer
  fileLibraryIncludesUpload?: boolean
  onUploadedFiles?: (files: UploadFileItem[]) => void | Promise<void>
  onReplace: (
    param: PowerParam,
    files: UploadFileItem[],
    options: ReferenceOption[]
  ) => void
  onMessage: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const ruleID = Number(param.upload_rule_id || 0)
  const resourceRule = resolveParamResourceRule(param, uploadRuleMeta)
  const multiple = isFilesParam(param)
  const maxSelection = resolveMaxFiles(param)
  const selectedCount = Math.max(Number(count || 0), files.length)
  const selected = selectedCount > 0
  const canOpenLibrary = Boolean(
    renderFileLibrary || (allowResourceLibrary && resourceRule)
  )
  const triggerLabel = selected
    ? `${param.name}，已选择 ${selectedCount} 项`
    : `${param.name}，选择素材`

  const replaceFiles = (nextFiles: UploadFileItem[]) => {
    onReplace(
      param,
      nextFiles,
      referenceOptions(param, nextFiles, resourceRule?.kind)
    )
    onMessage('')
  }

  const openPicker = () => {
    if (canOpenLibrary) {
      setPickerOpen(true)
      return
    }
    if (!Number.isFinite(ruleID) || ruleID <= 0) {
      onMessage(`参数“${param.name}”未配置上传规则。`)
      return
    }
    window.requestAnimationFrame(() => inputRef.current?.click())
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''
    if (selectedFiles.length === 0) {
      return
    }
    if (!Number.isFinite(ruleID) || ruleID <= 0) {
      onMessage(`参数“${param.name}”未配置上传规则。`)
      return
    }

    const remaining = multiple
      ? Math.max(maxSelection - files.length, 0)
      : 1
    if (remaining <= 0) {
      onMessage(`参数“${param.name}”最多选择 ${maxSelection} 个文件。`)
      return
    }

    setUploading(true)
    onMessage('')
    try {
      let nextFiles = multiple ? [...files] : []
      for (const file of selectedFiles.slice(0, remaining)) {
        const kind =
          resourceRule?.kind || resolveResourceKind({ accept: file.type })
        const uploaded = await uploadFileByRule(ruleID, file, {
          kind,
          bizKey: uploadBizKey,
          bizName: uploadBizName,
          transport: resourceRule?.transport,
        })
        await onUploadedFiles?.([uploaded])
        nextFiles = multiple ? [...nextFiles, uploaded] : [uploaded]
        replaceFiles(nextFiles)
      }
    } catch (error) {
      onMessage(error instanceof Error ? error.message : '上传失败。')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <ReferenceComposerControlTooltip
        label={triggerLabel}
        layerZIndex={layerZIndex}
      >
        <button
          type='button'
          className={`reference-composer-tool reference-composer-param-trigger${selected ? ' is-selected' : ''}`}
          aria-label={triggerLabel}
          aria-pressed={selected}
          disabled={disabled || uploading}
          onClick={openPicker}
        >
          {uploading ? (
            <Loader2 className='animate-spin' />
          ) : (
            <PowerParamIcon name={param.icon} />
          )}
          <span>{param.name}</span>
          {multiple && selected ? (
            <small className='reference-composer-param-count'>
              {selectedCount}
            </small>
          ) : null}
        </button>
      </ReferenceComposerControlTooltip>
      <input
        ref={inputRef}
        type='file'
        className='hidden'
        accept={String(uploadRuleMeta?.accept || '')}
        multiple={multiple}
        onChange={handleUpload}
      />
      {renderFileLibrary
        ? renderFileLibrary({
            open: pickerOpen,
            param,
            files,
            resourceKind: resourceRule?.kind,
            multiple,
            maxSelection,
            onOpenChange: setPickerOpen,
            onConfirm: replaceFiles,
          })
        : null}
      {!renderFileLibrary && allowResourceLibrary && resourceRule ? (
        <ResourcePickerDialogLazy
          open={pickerOpen}
          title={`选择${param.name}`}
          description='所选资源只用于本轮消息。'
          bizKey={uploadBizKey}
          defaultKind={resourceRule.kind}
          fixedKind={Boolean(resourceRule.kind)}
          value={files}
          multiple={multiple}
          maxSelection={maxSelection}
          uploadRules={[resourceRule]}
          allowUpload={fileLibraryIncludesUpload}
          assistantLayer
          layerZIndex={layerZIndex}
          onOpenChange={setPickerOpen}
          onConfirm={replaceFiles}
        />
      ) : null}
    </>
  )
}

export function ReferenceAttachmentMenu({
  disabled,
  layerZIndex,
  referenceActions = [],
  onReferenceSelect,
}: {
  disabled?: boolean
  layerZIndex?: number
  referenceActions?: ReferenceAttachmentAction[]
  onReferenceSelect?: (trigger: string) => void
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )

  if (referenceActions.length === 0) {
    return null
  }

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(open) => {
        if (open) {
          setPortalContainer(findFloatingLayerContainer(triggerRef.current))
        }
        setMenuOpen(open)
      }}
    >
      <ReferenceComposerControlTooltip
        label='添加'
        layerZIndex={layerZIndex}
      >
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type='button'
            className='reference-composer-tool reference-composer-add-trigger'
            aria-label='添加'
            disabled={disabled}
          >
            <Paperclip />
            <span>添加</span>
          </button>
        </DropdownMenuTrigger>
      </ReferenceComposerControlTooltip>
      <DropdownMenuContent
        align='start'
        side='top'
        container={portalContainer}
        className='z-[160] min-w-44'
      >
        <DropdownMenuLabel className='text-xs text-muted-foreground'>
          引用
        </DropdownMenuLabel>
        {referenceActions.map((action) => (
          <DropdownMenuItem
            key={action.trigger}
            onSelect={() => onReferenceSelect?.(action.trigger)}
          >
            <ReferenceActionIcon trigger={action.trigger} />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ReferenceToolbarActions({
  actions,
  disabled,
  layerZIndex,
  onSelect,
}: {
  actions: ReferenceAttachmentAction[]
  disabled?: boolean
  layerZIndex?: number
  onSelect: (trigger: string) => void
}) {
  return actions.map((action) => (
    <ReferenceComposerControlTooltip
      key={action.trigger}
      label={action.label}
      layerZIndex={layerZIndex}
    >
      <button
        type='button'
        className='reference-composer-tool'
        aria-label={action.label}
        disabled={disabled}
        onClick={() => onSelect(action.trigger)}
      >
        <ReferenceActionIcon trigger={action.trigger} />
      </button>
    </ReferenceComposerControlTooltip>
  ))
}

function ReferenceActionIcon({ trigger }: { trigger: string }) {
  return trigger === '#' ? <Hash /> : <AtSign />
}

function referenceOptions(
  param: PowerParam,
  files: UploadFileItem[],
  fallbackKind = 'file'
): ReferenceOption[] {
  const usage = String(param.key || '').trim()
  return uploadFileReferenceOptions(files, {
    usage,
    description: param.name,
    fallbackKind,
  })
}
