import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { AudioLines, Check, Image, Loader2, Save, Video, X } from 'lucide-react'
import { request } from '@/lib/request'
import { getStoreValueByPath } from '@/lib/store'
import {
  digestUploadFile,
  uploadFileDirect,
  type UploadDirectPayload,
} from '@/lib/upload'
import { RichTextEditor } from '@/components/rich-text-editor'
import type { NodeItemProps } from '../../nodes'

type DataFieldType =
  | 'text'
  | 'textarea'
  | 'editor'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'multi_select'
  | 'image'
  | 'video'
  | 'audio'

type DataFieldOption = {
  id?: number | string
  name?: string
  value?: string
  sort?: number
}

type DataField = {
  id?: number | string
  name?: string
  field_key?: string
  field_type?: DataFieldType | string
  default_value?: unknown
  placeholder?: string
  help_text?: string
  max_count?: number | string
  required?: boolean
  options?: DataFieldOption[]
}

type DataTemplate = {
  id?: number | string
  name?: string
  fields?: DataField[]
}

type DataRecord = {
  id?: number | string
  values?: Record<string, unknown>
}

type UploadRule = {
  id?: number | string
  name?: string
  accept?: string
  transport?: string
}

type UploadValue = {
  id?: number | string
  name?: string
  url?: string
  download?: string
  thumbnail?: string
  open_url?: string
  kind?: string
  mime?: string
  size?: number
}

type EditorPayload = {
  cate_id?: number | string
  category?: Record<string, unknown>
  templates?: DataTemplate[]
  records?: Record<string, DataRecord>
  selected_template_id?: number | string
  upload_rules?: Record<string, UploadRule>
  message?: string
}

type FieldErrors = Record<string, string>
type FieldValues = Record<string, unknown>

class RequestFailure extends Error {
  fieldErrors: FieldErrors

  constructor(message: string, fieldErrors: FieldErrors = {}) {
    super(message)
    this.fieldErrors = fieldErrors
  }
}

export function DataRecordEditor({ item, store }: NodeItemProps) {
  const dataPath =
    textValue(item?.value) || textValue(item?.meta?.dataPath) || 'data.editor'
  const editor = useMemo(
    () => normalizeEditorPayload(readStoreValue(store, dataPath)),
    [store, dataPath]
  )
  const templates = editor.templates || []
  const initialTemplateID =
    positiveID(editor.selected_template_id) || positiveID(templates[0]?.id)
  const [selectedTemplateID, setSelectedTemplateID] =
    useState(initialTemplateID)
  const [values, setValues] = useState<FieldValues>({})
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingFieldID, setUploadingFieldID] = useState('')
  const [recordOverrides, setRecordOverrides] = useState<
    Record<string, DataRecord>
  >({})

  useEffect(() => {
    const nextTemplateID =
      positiveID(editor.selected_template_id) || positiveID(templates[0]?.id)
    setSelectedTemplateID((current) => {
      if (
        current &&
        templates.some((template) => positiveID(template.id) === current)
      ) {
        return current
      }
      return nextTemplateID
    })
  }, [editor.selected_template_id, templates])

  const selectedTemplate = useMemo(
    () =>
      templates.find(
        (template) => positiveID(template.id) === selectedTemplateID
      ),
    [templates, selectedTemplateID]
  )
  const selectedRecord =
    recordOverrides[selectedTemplateID] || editor.records?.[selectedTemplateID]

  useEffect(() => {
    setValues(initialValuesForTemplate(selectedTemplate, selectedRecord))
    setFieldErrors({})
    setFormError('')
    setSuccessMessage('')
  }, [selectedTemplateID, selectedTemplate, selectedRecord])

  if (!positiveID(editor.cate_id)) {
    return (
      <EmptyState title='缺少模板分类' text='请在菜单地址里带上 cate_id。' />
    )
  }

  if (editor.message) {
    return <EmptyState title='无法加载数据模板' text={editor.message} />
  }

  if (templates.length === 0) {
    return (
      <EmptyState title='暂无数据模板' text='当前分类下没有启用的数据模板。' />
    )
  }

  const fields = selectedTemplate?.fields || []

  const saveRecord = async () => {
    if (!selectedTemplateID) return
    setSaving(true)
    setFormError('')
    setSuccessMessage('')
    setFieldErrors({})
    try {
      const result = await checkedRequest(
        '/front/route/action?path=front/data_record/set',
        'post',
        {
          key: 'save-record',
          payload: {
            data_template_id: selectedTemplateID,
            values,
          },
        }
      )
      setRecordOverrides((current) => ({
        ...current,
        [selectedTemplateID]: {
          ...(current[selectedTemplateID] || selectedRecord || {}),
          id: (result as Record<string, unknown>)?.['id'],
          values,
        },
      }))
      setSuccessMessage('已保存')
    } catch (error) {
      const failure = normalizeRequestFailure(error)
      setFormError(failure.message)
      setFieldErrors(normalizeFieldErrors(failure.fieldErrors))
    } finally {
      setSaving(false)
    }
  }

  const updateFieldValue = (field: DataField, nextValue: unknown) => {
    const fieldID = fieldIDText(field)
    setValues((current) => ({
      ...current,
      [fieldID]: nextValue,
    }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[fieldID]
      return next
    })
  }

  const uploadFiles = async (field: DataField, files: File[]) => {
    const fieldID = fieldIDText(field)
    const fieldType = fieldTypeText(field)
    const rule = editor.upload_rules?.[fieldType]
    if (!rule || !positiveID(rule.id)) {
      setFieldErrors((current) => ({
        ...current,
        [fieldID]: '缺少可用上传规则。',
      }))
      return
    }

    const currentFiles = uploadValues(values[fieldID])
    const maxCount = maxUploadCount(field)
    if (currentFiles.length + files.length > maxCount) {
      setFieldErrors((current) => ({
        ...current,
        [fieldID]: `最多上传 ${maxCount} 个文件。`,
      }))
      return
    }

    setUploadingFieldID(fieldID)
    try {
      const uploaded: UploadValue[] = []
      for (const file of files) {
        uploaded.push(await uploadDataRecordFile(file, rule, fieldType))
      }
      updateFieldValue(field, [...currentFiles, ...uploaded])
    } catch (error) {
      setFieldErrors((current) => ({
        ...current,
        [fieldID]: normalizeRequestFailure(error).message,
      }))
    } finally {
      setUploadingFieldID('')
    }
  }

  return (
    <div className='grid min-h-[540px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]'>
      <aside className='min-h-0 overflow-hidden rounded-md border bg-background'>
        <div className='border-b px-4 py-3'>
          <div className='text-sm font-medium'>数据模板</div>
          <div className='mt-1 text-xs text-muted-foreground'>
            {textValue(editor.category?.['name']) || '模板分类'}
          </div>
        </div>
        <div className='max-h-[calc(100vh-260px)] overflow-y-auto p-2'>
          {templates.map((template) => {
            const templateID = positiveID(template.id)
            const active = templateID === selectedTemplateID
            return (
              <button
                key={templateID}
                type='button'
                className={[
                  'mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                ].join(' ')}
                onClick={() => setSelectedTemplateID(templateID)}
              >
                <span className='min-w-0 truncate'>
                  {textValue(template.name) || '未命名模板'}
                </span>
                <span className='ml-2 shrink-0 text-xs opacity-70'>
                  {(template.fields || []).length}
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className='min-w-0 rounded-md border bg-background'>
        <div className='flex flex-wrap items-center gap-3 border-b px-5 py-4'>
          <div className='min-w-0 flex-1'>
            <h2 className='truncate text-base font-semibold'>
              {textValue(selectedTemplate?.name) || '数据模板'}
            </h2>
          </div>
          {successMessage ? (
            <span className='inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700'>
              <Check className='size-3' />
              {successMessage}
            </span>
          ) : null}
          <button
            type='button'
            className='inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60'
            disabled={saving || uploadingFieldID !== ''}
            onClick={() => void saveRecord()}
          >
            {saving ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Save className='size-4' />
            )}
            保存
          </button>
        </div>

        <div className='max-h-[calc(100vh-250px)] overflow-y-auto px-5 py-4'>
          {formError ? (
            <div className='mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {formError}
            </div>
          ) : null}

          {fields.length === 0 ? (
            <EmptyState title='暂无字段' text='当前模板还没有启用字段。' />
          ) : (
            <div className='space-y-5'>
              {fields.map((field) => {
                const fieldID = fieldIDText(field)
                return (
                  <FieldControl
                    key={fieldID}
                    field={field}
                    value={values[fieldID]}
                    error={fieldErrors[fieldID]}
                    uploadRule={editor.upload_rules?.[fieldTypeText(field)]}
                    uploading={uploadingFieldID === fieldID}
                    disabled={saving}
                    onChange={(nextValue) => updateFieldValue(field, nextValue)}
                    onUpload={(files) => void uploadFiles(field, files)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function FieldControl({
  field,
  value,
  error,
  uploadRule,
  uploading,
  disabled,
  onChange,
  onUpload,
}: {
  field: DataField
  value: unknown
  error?: string
  uploadRule?: UploadRule
  uploading?: boolean
  disabled?: boolean
  onChange: (value: unknown) => void
  onUpload: (files: File[]) => void
}) {
  const type = fieldTypeText(field)
  const fieldID = fieldIDText(field)
  const label = textValue(field.name) || '字段'

  return (
    <div className='grid gap-2 md:grid-cols-[150px_minmax(0,1fr)] md:gap-4'>
      <label
        className='pt-2 text-sm font-medium text-foreground'
        htmlFor={`data-field-${fieldID}`}
      >
        {label}
        {field.required ? (
          <span className='ml-1 text-destructive'>*</span>
        ) : null}
      </label>
      <div className='min-w-0'>
        {renderFieldInput({
          field,
          value,
          uploadRule,
          uploading,
          disabled,
          onChange,
          onUpload,
        })}
        {field.help_text ? (
          <div className='mt-1 text-xs text-muted-foreground'>
            {field.help_text}
          </div>
        ) : null}
        {uploadFieldTypes.has(type) &&
        (!uploadRule || !positiveID(uploadRule.id)) ? (
          <div className='mt-1 text-xs text-destructive'>
            缺少可用上传规则。
          </div>
        ) : null}
        {error ? (
          <div className='mt-1 text-xs text-destructive'>{error}</div>
        ) : null}
      </div>
    </div>
  )
}

function renderFieldInput(input: {
  field: DataField
  value: unknown
  uploadRule?: UploadRule
  uploading?: boolean
  disabled?: boolean
  onChange: (value: unknown) => void
  onUpload: (files: File[]) => void
}) {
  const { field, value, disabled, onChange } = input
  const type = fieldTypeText(field)
  const id = `data-field-${fieldIDText(field)}`
  const placeholder = textValue(field.placeholder)
  const baseClass =
    'min-h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60'

  switch (type) {
    case 'textarea':
      return (
        <textarea
          id={id}
          className={`${baseClass} min-h-[92px] resize-y`}
          value={textValue(value)}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )
    case 'editor':
      return (
        <RichTextEditor
          value={textValue(value)}
          onChange={onChange as (value: string) => void}
          contentFormat='markdown'
          placeholder={placeholder}
          minHeight={220}
          maxHeight={520}
          disabled={disabled}
        />
      )
    case 'date':
      return (
        <input
          id={id}
          type='date'
          className={baseClass}
          value={dateInputValue(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )
    case 'datetime':
      return (
        <input
          id={id}
          type='datetime-local'
          className={baseClass}
          value={dateTimeInputValue(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )
    case 'boolean':
      return (
        <label className='inline-flex h-9 items-center gap-2 text-sm'>
          <input
            id={id}
            type='checkbox'
            className='size-4'
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
          <span>{Boolean(value) ? '开启' : '关闭'}</span>
        </label>
      )
    case 'radio':
      return (
        <OptionRadio
          field={field}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case 'checkbox':
      return (
        <OptionCheckbox
          field={field}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case 'select':
      return (
        <select
          id={id}
          className={baseClass}
          value={textValue(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          <option value=''>{placeholder || '请选择'}</option>
          {(field.options || []).map((option) => (
            <option
              key={textValue(option.value)}
              value={textValue(option.value)}
            >
              {textValue(option.name) || textValue(option.value)}
            </option>
          ))}
        </select>
      )
    case 'multi_select':
      return (
        <select
          id={id}
          className={`${baseClass} min-h-[120px]`}
          multiple
          value={stringArray(value)}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              Array.from(event.currentTarget.selectedOptions).map(
                (option) => option.value
              )
            )
          }
        >
          {(field.options || []).map((option) => (
            <option
              key={textValue(option.value)}
              value={textValue(option.value)}
            >
              {textValue(option.name) || textValue(option.value)}
            </option>
          ))}
        </select>
      )
    case 'image':
    case 'video':
    case 'audio':
      return <UploadField {...input} />
    default:
      return (
        <input
          id={id}
          type='text'
          className={baseClass}
          value={textValue(value)}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )
  }
}

function OptionRadio({
  field,
  value,
  disabled,
  onChange,
}: {
  field: DataField
  value: unknown
  disabled?: boolean
  onChange: (value: unknown) => void
}) {
  const current = textValue(value)
  return (
    <div className='flex flex-wrap gap-3'>
      {(field.options || []).map((option) => {
        const optionValue = textValue(option.value)
        return (
          <label
            key={optionValue}
            className='inline-flex h-9 items-center gap-2 text-sm'
          >
            <input
              type='radio'
              name={`field-${fieldIDText(field)}`}
              className='size-4'
              value={optionValue}
              checked={current === optionValue}
              disabled={disabled}
              onChange={() => onChange(optionValue)}
            />
            <span>{textValue(option.name) || optionValue}</span>
          </label>
        )
      })}
    </div>
  )
}

function OptionCheckbox({
  field,
  value,
  disabled,
  onChange,
}: {
  field: DataField
  value: unknown
  disabled?: boolean
  onChange: (value: unknown) => void
}) {
  const current = new Set(stringArray(value))
  return (
    <div className='flex flex-wrap gap-3'>
      {(field.options || []).map((option) => {
        const optionValue = textValue(option.value)
        return (
          <label
            key={optionValue}
            className='inline-flex h-9 items-center gap-2 text-sm'
          >
            <input
              type='checkbox'
              className='size-4'
              value={optionValue}
              checked={current.has(optionValue)}
              disabled={disabled}
              onChange={(event) => {
                const next = new Set(current)
                if (event.currentTarget.checked) {
                  next.add(optionValue)
                } else {
                  next.delete(optionValue)
                }
                onChange(Array.from(next))
              }}
            />
            <span>{textValue(option.name) || optionValue}</span>
          </label>
        )
      })}
    </div>
  )
}

function UploadField({
  field,
  value,
  uploadRule,
  uploading,
  disabled,
  onChange,
  onUpload,
}: {
  field: DataField
  value: unknown
  uploadRule?: UploadRule
  uploading?: boolean
  disabled?: boolean
  onChange: (value: unknown) => void
  onUpload: (files: File[]) => void
}) {
  const files = uploadValues(value)
  const type = fieldTypeText(field)
  const maxCount = maxUploadCount(field)
  const accept = textValue(uploadRule?.accept) || `${type}/*`
  const canUpload = Boolean(
    uploadRule && positiveID(uploadRule.id) && files.length < maxCount
  )

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <label
          className={[
            'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium',
            canUpload && !disabled
              ? 'hover:bg-muted'
              : 'cursor-not-allowed opacity-60',
          ].join(' ')}
        >
          {uploadIcon(type)}
          <span>{uploading ? '上传中' : '选择文件'}</span>
          {uploading ? <Loader2 className='size-4 animate-spin' /> : null}
          <input
            type='file'
            className='hidden'
            accept={accept}
            multiple={maxCount > 1}
            disabled={!canUpload || disabled || uploading}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const selected = Array.from(event.currentTarget.files || [])
              event.currentTarget.value = ''
              if (selected.length > 0) onUpload(selected)
            }}
          />
        </label>
        <span className='text-xs text-muted-foreground'>
          {files.length}/{maxCount}
        </span>
      </div>

      {files.length > 0 ? (
        <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
          {files.map((file, index) => (
            <UploadPreviewItem
              key={`${file.id || file.url || file.name}-${index}`}
              file={file}
              type={type}
              onRemove={() =>
                onChange(
                  files.filter((_, currentIndex) => currentIndex !== index)
                )
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function UploadPreviewItem({
  file,
  type,
  onRemove,
}: {
  file: UploadValue
  type: string
  onRemove: () => void
}) {
  const source =
    textValue(file.url) || textValue(file.open_url) || textValue(file.download)
  return (
    <div className='relative overflow-hidden rounded-md border bg-muted/30'>
      <button
        type='button'
        className='absolute top-2 right-2 z-10 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow hover:text-destructive'
        onClick={onRemove}
      >
        <X className='size-4' />
      </button>
      <div className='flex h-36 items-center justify-center bg-background'>
        {type === 'image' && source ? (
          <img
            src={source}
            alt={textValue(file.name)}
            className='h-full w-full object-contain'
          />
        ) : type === 'video' && source ? (
          <video src={source} controls className='h-full w-full' />
        ) : type === 'audio' && source ? (
          <audio src={source} controls className='w-[90%]' />
        ) : (
          <div className='text-muted-foreground'>{uploadIcon(type)}</div>
        )}
      </div>
      <div className='truncate px-3 py-2 text-xs'>
        {textValue(file.name) || source || '文件'}
      </div>
    </div>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className='flex min-h-[240px] flex-col items-center justify-center rounded-md border border-dashed bg-background px-6 text-center'>
      <div className='text-sm font-medium'>{title}</div>
      <div className='mt-2 text-sm text-muted-foreground'>{text}</div>
    </div>
  )
}

async function uploadDataRecordFile(
  file: File,
  rule: UploadRule,
  kind: string
): Promise<UploadValue> {
  const hash = await digestUploadFile(file)
  const init = await checkedRequest('/front/upload/init', 'post', {
    rule_id: Number(rule.id || 0),
    name: file.name,
    size: file.size,
    mime: file.type,
    hash,
    kind,
    biz_key: 'front_data_record',
    biz_name: '数据模板',
  })

  const initData = init as Record<string, unknown>
  if (
    textValue(initData['transport'] || rule.transport).toLowerCase() ===
    'direct'
  ) {
    await uploadFileDirect(file, initData['direct'] as UploadDirectPayload)
  } else {
    const sessionID = Number(initData['session_id'] || 0)
    const chunkSize = Math.max(
      1,
      Number(initData['chunk_size'] || file.size || 1)
    )
    const chunkTotal = Math.max(
      1,
      Number(initData['chunk_total'] || Math.ceil(file.size / chunkSize))
    )
    for (let index = 0; index < chunkTotal; index += 1) {
      const start = index * chunkSize
      const end = Math.min(file.size, start + chunkSize)
      const form = new FormData()
      form.append('file', file.slice(start, end))
      await checkedRequest(
        `/front/upload/part?session_id=${sessionID}&part_number=${index + 1}`,
        'post',
        form
      )
    }
  }

  const completed = await checkedRequest('/front/upload/complete', 'post', {
    session_id: Number((init as Record<string, unknown>)['session_id'] || 0),
  })
  const payload = completed as Record<string, unknown>
  return {
    id: payload['id'] as number | string | undefined,
    name: textValue(payload['name']) || file.name,
    url:
      textValue(payload['url']) ||
      textValue(payload['open_url']) ||
      textValue(payload['download']),
    download: textValue(payload['download']),
    thumbnail: textValue(payload['thumbnail']),
    open_url: textValue(payload['open_url']),
    kind: textValue(payload['kind']) || kind,
    mime: textValue(payload['mime']) || file.type,
    size: Number(payload['size'] || file.size || 0),
  }
}

async function checkedRequest(
  path: string,
  method: 'get' | 'post',
  payload?: unknown
) {
  const result = await request(path, method, payload)
  if (isErrorResponse(result)) {
    const data = isRecord(result['data']) ? result['data'] : {}
    throw new RequestFailure(
      textValue(result['msg']) || textValue(result['message']) || '请求失败',
      isRecord(data['fieldErrors'])
        ? objectToTextRecord(data['fieldErrors'])
        : {}
    )
  }
  if (
    isRecord(result) &&
    'data' in result &&
    ('status' in result || 'code' in result)
  ) {
    return result['data']
  }
  return result
}

function isErrorResponse(result: unknown): result is Record<string, unknown> {
  if (!isRecord(result)) return false
  const code = Number(result['code'] || 0)
  const status = Number(result['status'] || 0)
  return code >= 400 || status === 2
}

function normalizeRequestFailure(error: unknown): RequestFailure {
  if (error instanceof RequestFailure) return error
  if (error instanceof Error)
    return new RequestFailure(error.message || '请求失败')
  return new RequestFailure(textValue(error) || '请求失败')
}

function normalizeFieldErrors(errors: FieldErrors): FieldErrors {
  const result: FieldErrors = {}
  for (const [path, message] of Object.entries(errors || {})) {
    const key = path.split('.').filter(Boolean).pop() || path
    result[key] = message
  }
  return result
}

function readStoreValue(store: NodeItemProps['store'], path: string) {
  return getStoreValueByPath(store, path)
}

function normalizeEditorPayload(value: unknown): EditorPayload {
  if (!isRecord(value)) return {}
  return {
    ...value,
    templates: Array.isArray(value['templates'])
      ? (value['templates'] as DataTemplate[])
      : [],
    records: isRecord(value['records'])
      ? (value['records'] as Record<string, DataRecord>)
      : {},
    upload_rules: isRecord(value['upload_rules'])
      ? (value['upload_rules'] as Record<string, UploadRule>)
      : {},
  }
}

function initialValuesForTemplate(
  template?: DataTemplate,
  record?: DataRecord
): FieldValues {
  const result: FieldValues = {}
  for (const field of template?.fields || []) {
    const fieldID = fieldIDText(field)
    result[fieldID] = defaultValueForField(field)
  }
  for (const [fieldID, value] of Object.entries(record?.values || {})) {
    result[fieldID] = value
  }
  return result
}

function defaultValueForField(field: DataField): unknown {
  const type = fieldTypeText(field)
  if (
    type === 'checkbox' ||
    type === 'multi_select' ||
    uploadFieldTypes.has(type)
  ) {
    return []
  }
  if (type === 'boolean') {
    return false
  }
  return field.default_value ?? ''
}

function uploadValues(value: unknown): UploadValue[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord) as UploadValue[]
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(textValue).filter(Boolean)
  }
  const text = textValue(value)
  return text ? [text] : []
}

function fieldIDText(field: DataField): string {
  return positiveID(field.id)
}

function fieldTypeText(field: DataField): string {
  return textValue(field.field_type) || 'text'
}

function maxUploadCount(field: DataField): number {
  const value = Number(field.max_count || 0)
  return value > 0 ? value : 1
}

function dateInputValue(value: unknown): string {
  return textValue(value).slice(0, 10)
}

function dateTimeInputValue(value: unknown): string {
  return textValue(value).replace(' ', 'T').slice(0, 16)
}

function uploadIcon(type: string) {
  if (type === 'video') return <Video className='size-4' />
  if (type === 'audio') return <AudioLines className='size-4' />
  return <Image className='size-4' />
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function positiveID(value: unknown): string {
  const text = textValue(value)
  return text && text !== '0' ? text : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function objectToTextRecord(value: Record<string, unknown>): FieldErrors {
  const result: FieldErrors = {}
  for (const [key, item] of Object.entries(value)) {
    result[key] = textValue(item)
  }
  return result
}

const uploadFieldTypes = new Set(['image', 'video', 'audio'])
