import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import {
  AtSign,
  FolderOpen,
  Hash,
  Loader2,
  Paperclip,
  Upload,
} from 'lucide-react'
import { findFloatingLayerContainer } from '@/lib/floating-layer'
import { uploadFileByRule, type UploadFileItem } from '@/lib/upload'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  isFileParam,
  isFilesParam,
  resolveMaxFiles,
  resolveParamResourceRule,
  type ParamFileLibraryRenderer,
  type ParamFileMap,
  type PowerParam,
} from '@/components/agent/stream-request-params'
import { ResourcePickerDialogLazy } from '@/components/resource/lazy-dialogs'
import { ReferenceComposerControlTooltip } from './tooltip'
import type { ReferenceOption } from './types'
import { uploadFileReferenceOptions } from './upload-reference'

const EMPTY_RESOURCE_SELECTION: UploadFileItem[] = []

export type ReferenceAttachmentAction = {
  trigger: string
  label: string
}

export function ReferenceAttachmentMenu({
  params,
  disabled,
  counts,
  layerZIndex,
  uploadBizKey,
  uploadBizName,
  allowResourceLibrary = true,
  files,
  renderFileLibrary,
  fileLibraryIncludesUpload = false,
  referenceActions = [],
  onUploadedFiles,
  onInsert,
  onReplace,
  onReferenceSelect,
  onMessage,
}: {
  params: PowerParam[]
  disabled?: boolean
  counts: Record<string, number>
  layerZIndex?: number
  uploadBizKey?: string
  uploadBizName?: string
  allowResourceLibrary?: boolean
  files: ParamFileMap
  renderFileLibrary?: ParamFileLibraryRenderer
  fileLibraryIncludesUpload?: boolean
  referenceActions?: ReferenceAttachmentAction[]
  onUploadedFiles?: (files: UploadFileItem[]) => void | Promise<void>
  onInsert: (
    param: PowerParam,
    files: UploadFileItem[],
    options: ReferenceOption[]
  ) => void
  onReplace: (
    param: PowerParam,
    files: UploadFileItem[],
    options: ReferenceOption[]
  ) => void
  onReferenceSelect?: (trigger: string) => void
  onMessage: (message: string) => void
}) {
  const fileParams = useMemo(() => params.filter(isFileParam), [params])
  const ruleIDs = useMemo(
    () => fileParams.map((param) => Number(param.upload_rule_id || 0)),
    [fileParams]
  )
  const ruleMetas = useUploadRuleMetas(ruleIDs)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )
  const [uploadParam, setUploadParam] = useState<PowerParam | null>(null)
  const [resourceParam, setResourceParam] = useState<PowerParam | null>(null)
  const [uploading, setUploading] = useState(false)
  const activeFileParams = useMemo(() => new Set(fileParams), [fileParams])
  const activeUploadParam =
    uploadParam && activeFileParams.has(uploadParam) ? uploadParam : null
  const activeResourceParam =
    resourceParam && activeFileParams.has(resourceParam) ? resourceParam : null
  const unifiedFilePicker = Boolean(
    fileLibraryIncludesUpload &&
      (allowResourceLibrary || Boolean(renderFileLibrary))
  )
  const triggerLabel = unifiedFilePicker ? '添加素材' : '添加'

  useEffect(() => {
    const keepActiveParam = (param: PowerParam | null) =>
      param && activeFileParams.has(param) ? param : null
    setUploadParam(keepActiveParam)
    setResourceParam(keepActiveParam)
    if (fileParams.length === 0 && referenceActions.length === 0) {
      setMenuOpen(false)
    }
  }, [activeFileParams, fileParams.length, referenceActions.length])

  if (fileParams.length === 0 && referenceActions.length === 0) {
    return null
  }

  const validateUploadRule = (param: PowerParam) => {
    const ruleID = Number(param.upload_rule_id || 0)
    if (!Number.isFinite(ruleID) || ruleID <= 0) {
      onMessage(`参数“${param.name}”未配置上传规则。`)
      return false
    }
    return true
  }

  const openUpload = (param: PowerParam) => {
    if (!validateUploadRule(param)) {
      return
    }
    setUploadParam(param)
    window.requestAnimationFrame(() => inputRef.current?.click())
  }

  const openResource = (param: PowerParam) => {
    if (!renderFileLibrary && !validateUploadRule(param)) {
      return
    }
    setResourceParam(param)
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    const param = activeUploadParam
    if (!param || selected.length === 0) {
      return
    }
    const ruleID = Number(param.upload_rule_id || 0)
    if (!Number.isFinite(ruleID) || ruleID <= 0) {
      onMessage(`参数“${param.name}”未配置上传规则。`)
      return
    }
    const remaining = remainingFiles(param, counts)
    if (remaining <= 0) {
      onMessage(
        `参数“${param.name}”最多选择 ${resolveMaxFiles(param)} 个文件。`
      )
      return
    }
    const rule = resolveParamResourceRule(param, ruleMetas.get(ruleID))
    setUploading(true)
    onMessage('')
    try {
      for (const file of selected.slice(0, remaining)) {
        const uploaded = await uploadFileByRule(ruleID, file, {
          kind: rule?.kind,
          bizKey: uploadBizKey,
          bizName: uploadBizName,
          transport: rule?.transport,
        })
        await onUploadedFiles?.([uploaded])
        onInsert(
          param,
          [uploaded],
          referenceOptions(param, [uploaded], rule?.kind)
        )
      }
    } catch (error) {
      onMessage(error instanceof Error ? error.message : '上传失败。')
    } finally {
      setUploading(false)
    }
  }

  const resourceRule = activeResourceParam
    ? resolveParamResourceRule(
        activeResourceParam,
        ruleMetas.get(Number(activeResourceParam.upload_rule_id || 0))
      )
    : undefined
  const resourceRemaining = activeResourceParam
    ? remainingFiles(activeResourceParam, counts)
    : 1

  return (
    <>
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
          label={triggerLabel}
          layerZIndex={layerZIndex}
        >
          <DropdownMenuTrigger asChild>
            <button
              ref={triggerRef}
              type='button'
              className='reference-composer-tool reference-composer-add-trigger'
              aria-label={triggerLabel}
              disabled={disabled || uploading}
            >
              {uploading ? <Loader2 className='animate-spin' /> : <Paperclip />}
              <span>{triggerLabel}</span>
            </button>
          </DropdownMenuTrigger>
        </ReferenceComposerControlTooltip>
        <DropdownMenuContent
          align='start'
          side='top'
          container={portalContainer}
          className='z-[160] min-w-44'
        >
          {fileParams.length > 0 ? (
            <>
              <DropdownMenuLabel className='text-xs text-muted-foreground'>
                素材
              </DropdownMenuLabel>
              {unifiedFilePicker ? (
                fileParams.map((param) => (
                  <DropdownMenuItem
                    key={`${param.id}:${param.key}`}
                    disabled={remainingFiles(param, counts) <= 0}
                    onSelect={() => openResource(param)}
                  >
                    <FolderOpen />
                    {param.name}
                  </DropdownMenuItem>
                ))
              ) : fileParams.length === 1 ? (
                <>
                  <DropdownMenuItem
                    disabled={remainingFiles(fileParams[0], counts) <= 0}
                    onSelect={() => openUpload(fileParams[0])}
                  >
                    <Upload />
                    上传
                  </DropdownMenuItem>
                  {allowResourceLibrary || renderFileLibrary ? (
                    <DropdownMenuItem
                      disabled={remainingFiles(fileParams[0], counts) <= 0}
                      onSelect={() => openResource(fileParams[0])}
                    >
                      <FolderOpen />
                      从资源库选择
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : (
                <>
                  <ParamSubMenu
                    icon={<Upload />}
                    label='上传'
                    params={fileParams}
                    counts={counts}
                    onSelect={openUpload}
                  />
                  {allowResourceLibrary || renderFileLibrary ? (
                    <ParamSubMenu
                      icon={<FolderOpen />}
                      label='从资源库选择'
                      params={fileParams}
                      counts={counts}
                      onSelect={openResource}
                    />
                  ) : null}
                </>
              )}
            </>
          ) : null}
          {fileParams.length > 0 && referenceActions.length > 0 ? (
            <DropdownMenuSeparator />
          ) : null}
          {referenceActions.length > 0 ? (
            <>
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
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={inputRef}
        type='file'
        className='hidden'
        accept={String(
          ruleMetas.get(Number(activeUploadParam?.upload_rule_id || 0))
            ?.accept || ''
        )}
        multiple={Boolean(
          activeUploadParam && isFilesParam(activeUploadParam)
        )}
        onChange={handleUpload}
      />
      {renderFileLibrary && activeResourceParam
        ? renderFileLibrary({
            open: true,
            param: activeResourceParam,
            files: files[String(activeResourceParam.key || '').trim()] || [],
            resourceKind: resourceRule?.kind,
            multiple: isFilesParam(activeResourceParam),
            maxSelection: resolveMaxFiles(activeResourceParam),
            onOpenChange: (open) => {
              if (!open) setResourceParam(null)
            },
            onConfirm: (selected) => {
              onReplace(
                activeResourceParam,
                selected,
                referenceOptions(
                  activeResourceParam,
                  selected,
                  resourceRule?.kind
                )
              )
              setResourceParam(null)
            },
          })
        : null}
      {!renderFileLibrary && allowResourceLibrary ? (
        <ResourcePickerDialogLazy
          open={Boolean(activeResourceParam)}
          title={`选择${activeResourceParam?.name || '资源'}`}
          description='所选资源只用于本轮消息。'
          bizKey={uploadBizKey}
          defaultKind={resourceRule?.kind}
          fixedKind={Boolean(resourceRule?.kind)}
          value={EMPTY_RESOURCE_SELECTION}
          multiple={Boolean(
            activeResourceParam && isFilesParam(activeResourceParam)
          )}
          maxSelection={Math.max(1, resourceRemaining)}
          uploadRules={resourceRule ? [resourceRule] : []}
          allowUpload={fileLibraryIncludesUpload}
          assistantLayer
          layerZIndex={layerZIndex}
          onOpenChange={(open) => {
            if (!open) {
              setResourceParam(null)
            }
          }}
          onConfirm={(files) => {
            const param = activeResourceParam
            if (!param) {
              return
            }
            const selected = files.slice(0, resourceRemaining)
            onInsert(
              param,
              selected,
              referenceOptions(param, selected, resourceRule?.kind)
            )
            setResourceParam(null)
          }}
        />
      ) : null}
    </>
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

function ParamSubMenu({
  icon,
  label,
  params,
  counts,
  onSelect,
}: {
  icon: ReactNode
  label: string
  params: PowerParam[]
  counts: Record<string, number>
  onSelect: (param: PowerParam) => void
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className='gap-2'>
        {icon}
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className='z-[170] min-w-44'>
        {params.map((param) => (
          <DropdownMenuItem
            key={`${param.id}:${param.key}`}
            disabled={remainingFiles(param, counts) <= 0}
            onSelect={() => onSelect(param)}
          >
            {param.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function remainingFiles(param: PowerParam, counts: Record<string, number>) {
  const key = String(param.key || '').trim()
  return Math.max(resolveMaxFiles(param) - Number(counts[key] || 0), 0)
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
