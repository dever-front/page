import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  FileText,
  FolderOpen,
  ImageIcon,
  Paperclip,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react'
import {
  assistantReferenceKindText,
  formatAssistantReferenceSize,
  readAssistantReferenceFile,
  uploadItemToAssistantReferenceFile,
  type AssistantReferenceFile,
} from '@/lib/assistant/reference'
import type { UploadFileItem } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ResourcePickerDialogLazy } from '@/components/resource/lazy-dialogs'

type AssistantReferencePickerProps = {
  references: AssistantReferenceFile[]
  disabled?: boolean
  buttonLabel?: string
  buttonClassName?: string
  maxFiles?: number
  onReferencesChange: (references: AssistantReferenceFile[]) => void
  onMessage?: (message: string) => void
}

type AssistantReferenceListProps = {
  references: AssistantReferenceFile[]
  disabled?: boolean
  onRemove: (index: number) => void
}

const DEFAULT_MAX_REFERENCE_FILES = 4

export function AssistantReferencePicker({
  references,
  disabled = false,
  buttonLabel = '添加参考',
  buttonClassName,
  maxFiles = DEFAULT_MAX_REFERENCE_FILES,
  onReferencesChange,
  onMessage,
}: AssistantReferencePickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [resourceOpen, setResourceOpen] = useState(false)
  const full = references.length >= maxFiles

  const addReferences = (items: AssistantReferenceFile[]) => {
    const slots = Math.max(0, maxFiles - references.length)
    if (slots === 0) {
      onMessage?.(`最多添加 ${maxFiles} 个参考。`)
      return
    }

    const nextItems = items.slice(0, slots)
    onReferencesChange([...references, ...nextItems])
    onMessage?.(items.length > slots ? `已添加前 ${slots} 个参考。` : '')
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) {
      return
    }

    onMessage?.('正在读取参考文件')
    try {
      const nextFiles: AssistantReferenceFile[] = []
      for (const file of files) {
        nextFiles.push(await readAssistantReferenceFile(file))
      }
      addReferences(nextFiles)
    } catch (error) {
      onMessage?.(error instanceof Error ? error.message : '读取参考文件失败')
    }
  }

  const handleResourceConfirm = (items: UploadFileItem[]) => {
    addReferences(items.map(uploadItemToAssistantReferenceFile))
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type='file'
        multiple
        className='hidden'
        accept='image/*,video/*,audio/*,text/*,.txt,.md,.json,.csv,.pdf,.doc,.docx,.xlsx'
        onChange={(event) => void handleFileChange(event)}
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className={cn('h-8 gap-1.5', buttonClassName)}
            disabled={disabled || full}
          >
            <Paperclip className='size-3.5' />
            {buttonLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          data-assistant-layer='true'
          align='start'
          className='z-[100] w-36'
        >
          <DropdownMenuItem
            onSelect={() => {
              fileInputRef.current?.click()
            }}
          >
            <Upload className='size-4' />
            上传文件
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setResourceOpen(true)
            }}
          >
            <FolderOpen className='size-4' />
            资源库
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResourcePickerDialogLazy
        open={resourceOpen}
        title='参考资料资源库'
        description='从历史资源中选择文件作为本轮 AI 参考。'
        initialScope='all'
        multiple
        maxSelection={Math.max(1, maxFiles - references.length)}
        emptyText='暂无可用资源。'
        allowUpload={false}
        assistantLayer
        onOpenChange={setResourceOpen}
        onConfirm={handleResourceConfirm}
      />
    </>
  )
}

export function AssistantReferenceList({
  references,
  disabled = false,
  onRemove,
}: AssistantReferenceListProps) {
  if (references.length === 0) {
    return null
  }

  return (
    <div className='space-y-2'>
      {references.map((file, index) => (
        <ReferenceFileRow
          key={`${file.name}-${file.size}-${index}`}
          file={file}
          disabled={disabled}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  )
}

function ReferenceFileRow({
  file,
  disabled,
  onRemove,
}: {
  file: AssistantReferenceFile
  disabled: boolean
  onRemove: () => void
}) {
  return (
    <div className='flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-2'>
      {referenceIcon(file)}
      <div className='min-w-0 flex-1'>
        <div className='truncate text-xs font-medium'>{file.name}</div>
        <div className='text-[11px] text-muted-foreground'>
          {assistantReferenceKindText(file)} ·{' '}
          {formatAssistantReferenceSize(file.size)}
        </div>
      </div>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-7 shrink-0'
        disabled={disabled}
        onClick={onRemove}
      >
        <X className='size-3.5' />
        <span className='sr-only'>移除参考资料</span>
      </Button>
    </div>
  )
}

function referenceIcon(file: AssistantReferenceFile): ReactNode {
  if (file.kind === 'image') {
    return <ImageIcon className='size-4 shrink-0 text-muted-foreground' />
  }
  if (file.kind === 'video') {
    return <Video className='size-4 shrink-0 text-muted-foreground' />
  }
  if (file.kind === 'audio') {
    return <Volume2 className='size-4 shrink-0 text-muted-foreground' />
  }
  return <FileText className='size-4 shrink-0 text-muted-foreground' />
}
