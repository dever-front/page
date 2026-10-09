import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { FileSpreadsheet, LoaderCircle, RefreshCw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { uploadFileByRule } from '@/lib/upload'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import { useActionSubmission } from '@/hooks/use-action-submission'
import {
  analyzeImportFile,
  createImportTask,
  getImportTaskInfo,
  type ImportAnalyzeResult,
  type ImportTaskInfo,
} from '@/lib/import-task'
import type { ImportActionPayload } from '@/lib/action'
import { runActionsWithResult } from '@/lib/action'
import { reloadStorePageSchema } from '@/lib/page-schema-reload'
import type { PageStore } from '@/lib/store'
import { SearchableOptionPicker } from '@/components/searchable-option-picker'

type ImportDialogProps = {
  open: boolean
  title: string
  description?: string
  payload: ImportActionPayload | null
  store: PageStore
  onOpenChange: (open: boolean) => void
}

export function ImportDialog({
  open,
  title,
  description,
  payload,
  store,
  onOpenChange,
}: ImportDialogProps) {
  const uploadRuleId = Number(payload?.uploadRuleId || 4)
  const uploadRuleMetas = useUploadRuleMetas(uploadRuleId > 0 ? [uploadRuleId] : [])
  const uploadRuleMeta = uploadRuleMetas.get(uploadRuleId)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const { submitting: submitLoading, isSubmitting, run } = useActionSubmission(
    store, undefined, {}, JSON.stringify(['import', payload?.path, payload?.importKey])
  )
  const handleOpenChange = (nextOpen: boolean) => {
    if (!isSubmitting()) onOpenChange(nextOpen)
  }
  const [uploadedFile, setUploadedFile] = useState<{ id: number; name: string; hash: string } | null>(null)
  const [analysis, setAnalysis] = useState<ImportAnalyzeResult | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [mappingByColumn, setMappingByColumn] = useState<Record<number, string>>({})
  const [matchFields, setMatchFields] = useState<string[]>([])
  const [matchMode, setMatchMode] = useState('any')
  const [fieldSettingsByField, setFieldSettingsByField] = useState<
    Record<string, { missingPolicy?: string; sourceMode?: string; baseDir?: string }>
  >({})
  const [task, setTask] = useState<ImportTaskInfo | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    setUploading(false)
    setLoadingAnalysis(false)
    setUploadedFile(null)
    setAnalysis(null)
    setSheetName('')
    setMappingByColumn({})
    setMatchFields([])
    setMatchMode('any')
    setFieldSettingsByField({})
    setTask(null)
    setMessage('')
  }, [open, payload?.importKey, payload?.path])

  useEffect(() => {
    if (!open || !task || !['pending', 'running'].includes(task.status)) {
      return
    }

    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const nextTask = await getImportTaskInfo(task.id)
        if (!cancelled) {
          setTask(nextTask)
        }
      } catch (error: any) {
        if (!cancelled) {
          setTask((current) =>
            current
              ? {
                  ...current,
                  status: 'failed',
                  error_message: error?.message || '导入任务轮询失败',
                }
              : current
          )
        }
      }
    }, 1000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [open, task])

  const mappings = useMemo(
    () =>
      (analysis?.columns || [])
        .map((column) => ({
          columnIndex: column.index,
          field: String(mappingByColumn[column.index] || '').trim(),
        }))
        .filter((item) => item.field),
    [analysis?.columns, mappingByColumn]
  )
  const fieldByName = useMemo(() => {
    const map = new Map<string, ImportAnalyzeResult['fields'][number]>()
    ;(analysis?.fields || []).forEach((field) => {
      map.set(field.field, field)
    })
    return map
  }, [analysis?.fields])

  const selectedFields = useMemo(() => {
    const counts = new Map<string, number>()
    Object.values(mappingByColumn).forEach((field) => {
      const key = String(field || '').trim()
      if (!key) {
        return
      }
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return counts
  }, [mappingByColumn])

  const handleAnalyze = async (
    fileId: number,
    nextSheetName?: string,
    fileHash = uploadedFile?.hash || ''
  ) => {
    if (!payload) {
      return
    }

    setLoadingAnalysis(true)
    setMessage('')
    try {
      const result = await analyzeImportFile({
        path: payload.path,
        importKey: payload.importKey,
        fileId,
        fileHash,
        sheetName: nextSheetName || '',
      })
      setAnalysis(result)
      setSheetName(result.sheet_name)
      setMappingByColumn(
        Object.fromEntries(result.columns.map((column) => [column.index, column.mappedField || '']))
      )
      setMatchFields(Array.isArray(result.match_fields) ? result.match_fields : [])
      setMatchMode(result.match_mode || 'any')
      setFieldSettingsByField(
        Object.fromEntries(
          (result.fields || []).map((field) => [
            field.field,
            {
              missingPolicy: String(field.missingPolicy || '').trim() || undefined,
              sourceMode: String(field.sourceMode || '').trim() || undefined,
              baseDir: String(field.baseDir || '').trim() || undefined,
            },
          ])
        )
      )
    } catch (error: any) {
      setAnalysis(null)
      setMappingByColumn({})
      setMatchFields([])
      setMatchMode('any')
      setFieldSettingsByField({})
      setMessage(error?.message || '分析导入文件失败')
    } finally {
      setLoadingAnalysis(false)
    }
  }

  const handleChooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const currentFile = event.target.files?.[0]
    event.target.value = ''
    if (!currentFile || !payload) {
      return
    }

    setUploading(true)
    setMessage('')
    try {
      const uploaded = await uploadFileByRule(uploadRuleId, currentFile, {
        kind: 'file',
        bizKey: buildImportFileBizKey(payload.path, payload.importKey),
        bizName: title || '导入文件',
      })
      const file = {
        id: Number(uploaded.id || 0),
        name: String(uploaded.name || currentFile.name).trim(),
        hash: String(uploaded.hash || '').trim(),
      }
      setUploadedFile(file)
      await handleAnalyze(file.id, '', file.hash)
    } catch (error: any) {
      setMessage(error?.message || '上传文件失败')
    } finally {
      setUploading(false)
    }
  }

  const handleStartImport = async () => {
    if (!payload || !uploadedFile || !sheetName || mappings.length === 0) {
      return
    }

    await run(async () => {
      setMessage('')
      try {
        const nextTask = await createImportTask({
          path: payload.path,
          importKey: payload.importKey,
          fileId: uploadedFile.id,
          fileHash: uploadedFile.hash,
          sheetName,
          mappings,
          matchFields,
          matchMode,
          fieldSettings: fieldSettingsByField,
        })
        setTask(nextTask)
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : '创建导入任务失败')
      }
    })
  }

  const handleFinish = () => run(async execution => {
    if (task?.status === 'success') {
      if (payload?.then) {
        const result = await runActionsWithResult(store, payload.then, execution)
        if (result.ignored) return
      } else {
        await reloadStorePageSchema(store)
      }
      toast.success(task.failed_rows > 0 ? `导入完成，失败 ${task.failed_rows} 行` : '导入完成')
    }
    onOpenChange(false)
  })

  const progressValue = Math.max(0, Math.min(Number(task?.progress || 0), 100))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-hidden sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{title || '导入配置'}</DialogTitle>
          <DialogDescription>
            {description || '上传 Excel 文件后，可检查列映射并开始导入。'}
          </DialogDescription>
        </DialogHeader>

        {task ? (
          <div className='max-h-[70vh] space-y-4 overflow-auto pr-1'>
            <div className='h-2 overflow-hidden rounded-full bg-muted'>
              <div
                className='h-full rounded-full bg-primary transition-all'
                style={{ width: `${progressValue}%` }}
              />
            </div>

            <div className='flex items-center justify-between text-sm text-muted-foreground'>
              <span>{task.stage || '等待开始'}</span>
              <span>{progressValue}%</span>
            </div>

            <div className='grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-3'>
              <SummaryCard label='总行数' value={task.total_rows} />
              <SummaryCard label='成功' value={task.success_rows} />
              <SummaryCard label='失败' value={task.failed_rows} />
            </div>

            {Array.isArray(task.summary?.errors) && task.summary?.errors.length > 0 ? (
              <div className='space-y-2 rounded-lg border p-4'>
                <div className='text-sm font-medium'>错误示例</div>
                <div className='max-h-48 space-y-2 overflow-auto pr-1 text-sm text-muted-foreground'>
                  {task.summary?.errors.map((error: any, index: number) => (
                    <div key={`${error?.row || index}-${index}`} className='rounded-md bg-muted/40 px-3 py-2'>
                      第 {Number(error?.row || 0)} 行：{String(error?.message || '')}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {task.status === 'failed' ? (
              <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                {task.error_message || '导入失败'}
              </div>
            ) : null}
          </div>
        ) : (
          <div className='max-h-[70vh] space-y-4 overflow-auto pr-1'>
            <input
              ref={inputRef}
              type='file'
              accept='.xlsx'
              className='hidden'
              onChange={(event) => void handleChooseFile(event)}
            />

            <div className='flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4'>
              <div className='flex min-w-0 flex-1 items-center gap-3'>
                <div className='rounded-md bg-primary/10 p-2 text-primary'>
                  <FileSpreadsheet className='size-5' />
                </div>
                <div className='min-w-0'>
                  <div className='truncate text-sm font-medium'>
                    {uploadedFile?.name || '请选择需要导入的 Excel 文件'}
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    当前仅支持 .xlsx 文件。{uploadRuleMeta?.name ? `上传规则：${uploadRuleMeta.name}` : ''}
                  </div>
                </div>
              </div>

              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => inputRef.current?.click()}
                disabled={uploading || loadingAnalysis || submitLoading}
              >
                {uploading ? <LoaderCircle className='size-4 animate-spin' /> : <Upload className='size-4' />}
                {uploadedFile ? '重新上传' : '上传文件'}
              </Button>

              {uploadedFile ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => void handleAnalyze(uploadedFile.id, sheetName)}
                  disabled={uploading || loadingAnalysis || submitLoading}
                >
                  {loadingAnalysis ? <LoaderCircle className='size-4 animate-spin' /> : <RefreshCw className='size-4' />}
                  重新分析
                </Button>
              ) : null}
            </div>

            {analysis ? (
              <div className='space-y-4'>
                <div className='flex flex-wrap items-center gap-3'>
                  <div className='text-sm text-muted-foreground'>
                    已识别 {analysis.columns.length} 列，可映射 {analysis.fields.length} 个字段。
                  </div>
                  {analysis.sheets.length > 1 ? (
                    <div className='flex items-center gap-2'>
                      <span className='text-sm text-muted-foreground'>工作表</span>
                      <Select
                        value={sheetName}
                        onValueChange={(value) => {
                          setSheetName(value)
                          if (uploadedFile?.id) {
                            void handleAnalyze(uploadedFile.id, value)
                          }
                        }}
                      >
                        <SelectTrigger className='w-[180px]'>
                          <SelectValue placeholder='选择工作表' />
                        </SelectTrigger>
                        <SelectContent>
                          {analysis.sheets.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                {analysis.match_options.length > 0 ? (
                  <div className='grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_11rem]'>
                    <div className='space-y-2'>
                      <div className='text-sm font-medium'>匹配字段</div>
                      <SearchableOptionPicker
                        value={matchFields}
                        options={analysis.match_options.map((item) => ({
                          id: item.field,
                          value: item.label,
                        }))}
                        multiple
                        placeholder='不匹配旧记录'
                        searchPlaceholder='输入字段名筛选...'
                        className='w-full'
                        onChange={(nextValue) =>
                          setMatchFields(
                            Array.isArray(nextValue) ? nextValue.map((item) => String(item).trim()).filter(Boolean) : []
                          )
                        }
                        onClear={() => setMatchFields([])}
                      />
                      <div className='text-xs text-muted-foreground'>
                        只用这里选中的字段判断更新还是插入；不选则始终尝试插入。
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <div className='text-sm font-medium'>匹配模式</div>
                      <Select value={matchMode || 'any'} onValueChange={setMatchMode}>
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='选择匹配模式' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='any'>任一命中</SelectItem>
                          <SelectItem value='all'>全部命中</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}

                <div className='rounded-lg border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-[26%]'>Excel 列</TableHead>
                        <TableHead className='w-[26%]'>示例值</TableHead>
                        <TableHead>映射字段</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.columns.map((column) => (
                        <TableRow key={column.index}>
                          <TableCell className='align-top'>
                            <div className='font-medium'>{column.header}</div>
                            <div className='text-xs text-muted-foreground'>第 {column.index + 1} 列</div>
                          </TableCell>
                          <TableCell className='align-top text-sm text-muted-foreground'>
                            {column.sample || '—'}
                          </TableCell>
                          <TableCell className='align-top'>
                            <Select
                              value={String(mappingByColumn[column.index] || '') || '__none__'}
                              onValueChange={(value) =>
                                setMappingByColumn((current) => ({
                                  ...current,
                                  [column.index]: value === '__none__' ? '' : value,
                                }))
                              }
                            >
                              <SelectTrigger className='w-full min-w-[220px]'>
                                <SelectValue placeholder='不导入该列' />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value='__none__'>不导入该列</SelectItem>
                                {analysis.fields.map((field) => {
                                  const selectedCount = selectedFields.get(field.field) || 0
                                  const currentValue = String(mappingByColumn[column.index] || '').trim()
                                  const disabled =
                                    selectedCount > 0 && currentValue !== field.field

                                  return (
                                    <SelectItem key={field.field} value={field.field} disabled={disabled}>
                                      <span className='flex flex-col items-start gap-0.5'>
                                        <span>{field.label}</span>
                                        <span className='text-xs text-muted-foreground'>
                                          {renderFieldHint(field)}
                                        </span>
                                      </span>
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>

                            {(() => {
                              const field = fieldByName.get(String(mappingByColumn[column.index] || '').trim())
                              if (!field?.tip) {
                                return null
                              }

                              return (
                                <div className='mt-1 text-xs text-muted-foreground'>
                                  {field.tip}
                                </div>
                              )
                            })()}

                            {(() => {
                              const field = fieldByName.get(String(mappingByColumn[column.index] || '').trim())
                              if (!field || !supportsMissingPolicy(field)) {
                                return null
                              }

                              const missingPolicy =
                                String(fieldSettingsByField[field.field]?.missingPolicy || field.missingPolicy || 'error').trim() || 'error'
                              const sourceMode =
                                String(fieldSettingsByField[field.field]?.sourceMode || field.sourceMode || 'auto').trim() || 'auto'
                              const baseDir = String(fieldSettingsByField[field.field]?.baseDir || field.baseDir || '').trim()

                              return (
                                <div className='mt-2 space-y-2'>
                                  <div className='flex items-center gap-2'>
                                    <span className='shrink-0 text-xs text-muted-foreground'>缺失值</span>
                                    <Select
                                      value={missingPolicy}
                                      onValueChange={(value) =>
                                        setFieldSettingsByField((current) => ({
                                          ...current,
                                          [field.field]: {
                                            ...current[field.field],
                                            missingPolicy: value,
                                          },
                                        }))
                                      }
                                    >
                                      <SelectTrigger className='h-8 w-[140px]'>
                                        <SelectValue placeholder='缺失值处理' />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getMissingPolicyOptions(field).map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {field.kind === 'upload' ? (
                                    <div className='grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]'>
                                      <div className='flex items-center gap-2'>
                                        <span className='shrink-0 text-xs text-muted-foreground'>资源来源</span>
                                        <Select
                                          value={sourceMode}
                                          onValueChange={(value) =>
                                            setFieldSettingsByField((current) => ({
                                              ...current,
                                              [field.field]: {
                                                ...current[field.field],
                                                sourceMode: value,
                                              },
                                            }))
                                          }
                                        >
                                          <SelectTrigger className='h-8 w-[140px]'>
                                            <SelectValue placeholder='选择来源模式' />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value='auto'>自动</SelectItem>
                                            <SelectItem value='embed'>贴图优先</SelectItem>
                                            <SelectItem value='path'>路径优先</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Input
                                        value={baseDir}
                                        className='h-8'
                                        placeholder='基础目录，可留空'
                                        onChange={(event) =>
                                          setFieldSettingsByField((current) => ({
                                            ...current,
                                            [field.field]: {
                                              ...current[field.field],
                                              baseDir: event.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {message ? (
              <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                {message}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {task ? (
            <Button type='button' disabled={submitLoading} onClick={() => void handleFinish()}>
              {task.status === 'failed' ? '关闭' : '完成'}
            </Button>
          ) : (
            <>
              <Button type='button' variant='outline' disabled={submitLoading} onClick={() => handleOpenChange(false)}>
                取消
              </Button>
              <Button
                type='button'
                onClick={() => void handleStartImport()}
                disabled={!uploadedFile || !analysis || mappings.length === 0 || submitLoading || loadingAnalysis}
              >
                {submitLoading ? <LoaderCircle className='size-4 animate-spin' /> : null}
                开始导入
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-md bg-background px-3 py-2'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 text-lg font-semibold'>{Number(value || 0)}</div>
    </div>
  )
}

function renderFieldHint(field: ImportAnalyzeResult['fields'][number]) {
  const kindLabel =
    field.kind === 'relation'
      ? '关联'
      : field.kind === 'option'
        ? '选项'
        : field.kind === 'children'
          ? '子表'
          : field.kind === 'cascade'
            ? '级联'
            : field.kind === 'upload'
              ? '上传'
            : field.kind === 'service'
              ? '服务'
          : '普通字段'
  const parts = [kindLabel]
  if (field.multiple) {
    parts.push('多值')
  }
  if (field.missingPolicy === 'create') {
    parts.push('缺失新建')
  }
  if (field.missingPolicy === 'skip') {
    parts.push('缺失跳过')
  }
  if (field.kind === 'upload' && field.uploadKind) {
    parts.push(field.uploadKind)
  }
  return parts.join(' · ')
}

function supportsMissingPolicy(field: ImportAnalyzeResult['fields'][number]) {
  return ['relation', 'cascade', 'service', 'upload'].includes(String(field.kind || '').trim())
}

function getMissingPolicyOptions(field: ImportAnalyzeResult['fields'][number]) {
  if (String(field.kind || '').trim() === 'upload') {
    return [
      { value: 'error', label: '报错' },
      { value: 'skip', label: '跳过' },
    ]
  }

  return [
    { value: 'error', label: '报错' },
    { value: 'create', label: '自动新建' },
  ]
}

function buildImportFileBizKey(pagePath: string, importKey: string) {
  const pageSegment = normalizeImportFileBizSegment(pagePath)
  const keySegment = normalizeImportFileBizSegment(importKey)
  if (!pageSegment || !keySegment) {
    return ''
  }
  return `${pageSegment}.import.${keySegment}`
}

function normalizeImportFileBizSegment(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, '')
    .replace(/\\/g, '/')
    .replace(/^[/\\.]+|[/\\.]+$/g, '')
    .replace(/\//g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}
