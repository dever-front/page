import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { FolderOpen, Loader2, Paperclip, Upload } from 'lucide-react'
import { findFloatingLayerContainer } from '@/lib/floating-layer'
import { uploadFileByRule, type UploadFileItem } from '@/lib/upload'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  type PowerParam,
} from '@/components/agent/stream-request-params'
import { ResourcePickerDialogLazy } from '@/components/resource/lazy-dialogs'
import type { ReferenceOption } from './types'
import { uploadFileReferenceOptions } from './upload-reference'

const EMPTY_RESOURCE_SELECTION: UploadFileItem[] = []

export function ReferenceAttachmentMenu({
  params,
  disabled,
  counts,
  layerZIndex,
  onInsert,
  onMessage,
}: {
  params: PowerParam[]
  disabled?: boolean
  counts: Record<string, number>
  layerZIndex?: number
  onInsert: (
    param: PowerParam,
    files: UploadFileItem[],
    options: ReferenceOption[]
  ) => void
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

  if (fileParams.length === 0) {
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
    if (!validateUploadRule(param)) {
      return
    }
    setResourceParam(param)
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    const param = uploadParam
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
      const files: UploadFileItem[] = []
      for (const file of selected.slice(0, remaining)) {
        files.push(
          await uploadFileByRule(ruleID, file, {
            kind: rule?.kind,
            transport: rule?.transport,
          })
        )
      }
      onInsert(param, files, referenceOptions(param, files, rule?.kind))
    } catch (error) {
      onMessage(error instanceof Error ? error.message : '上传失败。')
    } finally {
      setUploading(false)
    }
  }

  const resourceRule = resourceParam
    ? resolveParamResourceRule(
        resourceParam,
        ruleMetas.get(Number(resourceParam.upload_rule_id || 0))
      )
    : undefined
  const resourceRemaining = resourceParam
    ? remainingFiles(resourceParam, counts)
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
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type='button'
            className='reference-composer-tool'
            title='添加附件'
            disabled={disabled || uploading}
          >
            {uploading ? <Loader2 className='animate-spin' /> : <Paperclip />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='start'
          side='top'
          container={portalContainer}
          className='z-[160] min-w-44'
        >
          {fileParams.length === 1 ? (
            <>
              <DropdownMenuItem
                disabled={remainingFiles(fileParams[0], counts) <= 0}
                onSelect={() => openUpload(fileParams[0])}
              >
                <Upload />
                上传
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={remainingFiles(fileParams[0], counts) <= 0}
                onSelect={() => openResource(fileParams[0])}
              >
                <FolderOpen />
                从资源库选择
              </DropdownMenuItem>
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
              <ParamSubMenu
                icon={<FolderOpen />}
                label='从资源库选择'
                params={fileParams}
                counts={counts}
                onSelect={openResource}
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={inputRef}
        type='file'
        className='hidden'
        accept={String(
          ruleMetas.get(Number(uploadParam?.upload_rule_id || 0))?.accept || ''
        )}
        multiple={Boolean(uploadParam && isFilesParam(uploadParam))}
        onChange={handleUpload}
      />
      <ResourcePickerDialogLazy
        open={Boolean(resourceParam)}
        title={`选择${resourceParam?.name || '资源'}`}
        description='所选资源只用于本轮消息。'
        defaultKind={resourceRule?.kind}
        fixedKind={Boolean(resourceRule?.kind)}
        value={EMPTY_RESOURCE_SELECTION}
        multiple={Boolean(resourceParam && isFilesParam(resourceParam))}
        maxSelection={Math.max(1, resourceRemaining)}
        uploadRules={resourceRule ? [resourceRule] : []}
        allowUpload={false}
        assistantLayer
        layerZIndex={layerZIndex}
        onOpenChange={(open) => {
          if (!open) {
            setResourceParam(null)
          }
        }}
        onConfirm={(files) => {
          const param = resourceParam
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
    </>
  )
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
