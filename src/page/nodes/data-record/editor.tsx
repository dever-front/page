import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useStore } from 'zustand'
import { getStoreValueByPath } from '@/lib/store'
import type { Item } from '@/lib/schema'
import { NodeList, type NodeItemProps } from '../../nodes'

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

type EditorPayload = {
  cate_id?: number | string
  category?: Record<string, unknown>
  templates?: DataTemplate[]
  records?: Record<string, DataRecord>
  selected_template_id?: number | string
  upload_rules?: Record<string, UploadRule>
  message?: string
}

type FieldValues = Record<string, unknown>

const editorFormPath = 'data.form'
const virtualFormNodeKey = 'data-record-editor-fields'
const emptyFieldValues: FieldValues = {}
const emptyDataFields: DataField[] = []

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
  const [recordOverrides, setRecordOverrides] = useState<
    Record<string, DataRecord>
  >({})
  const storeFormTemplateID = useStore(store, (state) =>
    positiveID(state.data?.form?.data_template_id)
  )
  const storeFormSignature = useStore(store, (state) =>
    formStateSignature(state.data?.form)
  )

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
  const fields = useMemo(
    () => selectedTemplate?.fields || emptyDataFields,
    [selectedTemplate]
  )

  useEffect(() => {
    const nextValues = initialValuesForTemplate(selectedTemplate, selectedRecord)
    syncStoreFormValues(store, selectedTemplateID, nextValues)
  }, [store, selectedTemplateID, selectedTemplate, selectedRecord])

  useEffect(() => {
    syncVirtualFormNodes(store, fields, editor.upload_rules)
    return () => syncVirtualFormNodes(store, [])
  }, [store, fields, editor.upload_rules])

  useEffect(() => {
    if (!selectedTemplateID || storeFormTemplateID !== selectedTemplateID) {
      return
    }
    const nextValues = readStoreFormValues(store, fields)
    setRecordOverrides((current) =>
      updateTemplateRecordValues(
        current,
        selectedTemplateID,
        selectedRecord,
        nextValues
      )
    )
  }, [
    fields,
    selectedRecord,
    store,
    storeFormSignature,
    selectedTemplateID,
    storeFormTemplateID,
  ])

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

  return (
    <div className='flex min-h-[calc(100vh-220px)] items-start gap-6'>
      <nav className='w-44 shrink-0 space-y-2'>
        {templates.map((template) => {
          const templateID = positiveID(template.id)
          const active = templateID === selectedTemplateID
          return (
            <button
              key={templateID}
              type='button'
              className={[
                'flex min-h-10 w-full items-center rounded-md px-4 text-left text-sm transition',
                active
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              ].join(' ')}
              onClick={() => setSelectedTemplateID(templateID)}
            >
              <span className='min-w-0 truncate'>
                {textValue(template.name) || '未命名模板'}
              </span>
            </button>
          )
        })}
      </nav>

      <section className='min-w-0 flex-1 rounded-md border bg-background p-6'>
        {fields.length === 0 ? (
          <EmptyState title='暂无字段' text='当前模板还没有启用字段。' />
        ) : (
          <NodeList layoutId={virtualFormNodeKey} />
        )}
      </section>
    </div>
  )
}

function updateTemplateRecordValues(
  records: Record<string, DataRecord>,
  templateID: string,
  selectedRecord: DataRecord | undefined,
  values: FieldValues
) {
  if (!templateID) return records
  const existing = records[templateID] || selectedRecord || {}
  if (fieldValuesEqual(existing.values || {}, values)) {
    return records
  }
  return {
    ...records,
    [templateID]: {
      ...existing,
      values,
    },
  }
}

function syncVirtualFormNodes(
  store: NodeItemProps['store'],
  fields: DataField[],
  uploadRules: Record<string, UploadRule> = {}
) {
  const virtualNodes = fields.map((field) =>
    buildVirtualFormNode(field, uploadRules)
  )
  store.setState((state) => {
    const currentNodes = state.schema.nodes?.[virtualFormNodeKey]
    if (virtualFormNodesEqual(currentNodes, virtualNodes)) {
      return state
    }

    return {
      schema: {
        ...state.schema,
        nodes: {
          ...state.schema.nodes,
          [virtualFormNodeKey]: virtualNodes,
        },
      },
    }
  })
}

function syncStoreFormValues(
  store: NodeItemProps['store'],
  templateID: string,
  values: FieldValues
) {
  if (!templateID) return
  const form = store.getState().data?.form
  const currentTemplateID = isRecord(form)
    ? positiveID(form.data_template_id)
    : ''
  const currentValues =
    isRecord(form) && isRecord(form.values) ? form.values : emptyFieldValues
  if (
    currentTemplateID === templateID &&
    fieldValuesEqual(currentValues, values)
  ) {
    return
  }
  store.getState().setValueByPath(editorFormPath, {
    data_template_id: templateID,
    values,
  })
}

function readStoreFormValues(
  store: NodeItemProps['store'],
  fields: DataField[]
) {
  const form = store.getState().data?.form
  const source = isRecord(form) ? form.values : undefined
  return sanitizeTemplateValues(fields, source)
}

function formStateSignature(form: unknown) {
  if (!isRecord(form)) {
    return ':[]'
  }
  const templateID = positiveID(form.data_template_id)
  const values = isRecord(form.values) ? form.values : emptyFieldValues
  return `${templateID}:${fieldValuesSignature(values)}`
}

function fieldValuesSignature(values: FieldValues) {
  const keys = Object.keys(values).sort()
  return JSON.stringify(keys.map((key) => [key, values[key] ?? null]))
}

function buildVirtualFormNode(
  field: DataField,
  uploadRules: Record<string, UploadRule>
): Item {
  const fieldID = fieldIDText(field)
  const fieldType = fieldTypeText(field)
  const label = textValue(field.name) || '字段'
  const uploadRule = uploadRules[fieldType]
  const item: Item = {
    id: virtualFieldID(field),
    type: fieldTypeToFormNodeType(fieldType),
    name: label,
    mode: 'form',
    value: `form.values.${fieldID}`,
    placeholder: fieldPlaceholder(field),
    info: textValue(field.help_text),
    validate: field.required
      ? [
          {
            type: 'required',
            message: `${label}不能为空。`,
          },
        ]
      : undefined,
    meta: {
      formLayout: 'horizontal',
      contentFormat: fieldType === 'editor' ? 'json' : undefined,
      minHeight: fieldType === 'editor' ? 420 : undefined,
      maxHeight: fieldType === 'editor' ? 720 : undefined,
      uploadRules: fieldType === 'editor'
        ? editorUploadRules(uploadRules)
        : undefined,
      uploadType: uploadFieldUploadType(fieldType),
      kind: uploadFieldKind(fieldType),
      ruleId: uploadRule ? Number(uploadRule.id || 0) : undefined,
      maxCount: uploadFieldTypes.has(fieldType) ? maxUploadCount(field) : undefined,
      multiple: fieldType === 'multi_select' ? true : undefined,
      inputType: fieldType === 'datetime' ? 'datetime' : undefined,
      saveMode: uploadFieldTypes.has(fieldType) ? 'url' : undefined,
      bizKey: uploadFieldTypes.has(fieldType) ? 'front_data_record' : undefined,
      bizName: uploadFieldTypes.has(fieldType) ? '数据模板' : undefined,
    },
    option: optionFieldTypes.has(fieldType)
      ? (field.options || []).map((option) => ({
          id: textValue(option.value),
          value: textValue(option.name) || textValue(option.value),
          name: textValue(option.name) || textValue(option.value),
        }))
      : undefined,
  }
  return item
}

function fieldTypeToFormNodeType(fieldType: string) {
  switch (fieldType) {
    case 'textarea':
      return 'form-textarea'
    case 'editor':
      return 'form-editor'
    case 'date':
    case 'datetime':
      return 'form-date'
    case 'boolean':
      return 'form-switch'
    case 'radio':
      return 'form-radio'
    case 'checkbox':
      return 'form-checkbox'
    case 'select':
    case 'multi_select':
      return 'form-select'
    case 'image':
    case 'video':
    case 'audio':
      return 'form-upload'
    default:
      return 'form-input'
  }
}

function sanitizeTemplateValues(fields: DataField[], source: unknown) {
  const record = isRecord(source) ? source : {}
  const result: FieldValues = {}
  for (const field of fields) {
    const fieldID = fieldIDText(field)
    if (!fieldID || !(fieldID in record)) continue
    result[fieldID] = record[fieldID]
  }
  return result
}

function fieldValuesEqual(left: FieldValues, right: FieldValues) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => fieldValueEqual(left[key], right[key]))
}

function fieldValueEqual(left: unknown, right: unknown) {
  if (left === right) return true
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function virtualFormNodesEqual(current: unknown, next: Item[]) {
  if (!Array.isArray(current)) {
    return next.length === 0
  }
  if (current.length !== next.length) {
    return false
  }
  return current.every((item, index) => fieldValueEqual(item, next[index]))
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className='flex min-h-[240px] flex-col items-center justify-center rounded-md border border-dashed bg-background px-6 text-center'>
      <div className='text-sm font-medium'>{title}</div>
      <div className='mt-2 text-sm text-muted-foreground'>{text}</div>
    </div>
  )
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

function fieldIDText(field: DataField): string {
  return positiveID(field.id)
}

function virtualFieldID(field: DataField): string {
  return `data-record-field-${fieldIDText(field)}`
}

function fieldTypeText(field: DataField): string {
  return textValue(field.field_type) || 'text'
}

function fieldPlaceholder(field: DataField): string {
  const customPlaceholder = textValue(field.placeholder)
  if (customPlaceholder) {
    return customPlaceholder
  }

  const label = textValue(field.name) || '内容'
  const type = fieldTypeText(field)
  if (
    type === 'radio' ||
    type === 'checkbox' ||
    type === 'select' ||
    type === 'multi_select' ||
    type === 'date' ||
    type === 'datetime' ||
    type === 'boolean'
  ) {
    return `请选择${label}`
  }
  if (uploadFieldTypes.has(type)) {
    return `请上传${label}`
  }
  return `请输入${label}`
}

function editorUploadRules(uploadRules: Record<string, UploadRule>) {
  return uploadFieldKinds
    .map((kind) => uploadRuleConfig(kind, uploadRules[kind]))
    .filter((rule): rule is NonNullable<ReturnType<typeof uploadRuleConfig>> =>
      Boolean(rule)
    )
}

function uploadRuleConfig(kind: string, rule?: UploadRule) {
  const ruleID = Number(rule?.id || 0)
  if (!ruleID) {
    return null
  }
  return {
    ruleId: ruleID,
    kind,
    accept: textValue(rule?.accept) || `${kind}/*`,
    transport: textValue(rule?.transport) || undefined,
    bizKey: 'front_data_record',
    bizName: '数据模板',
  }
}

function uploadFieldUploadType(fieldType: string) {
  switch (fieldType) {
    case 'image':
      return 'pic'
    case 'video':
      return 'video'
    case 'audio':
      return 'audio'
    default:
      return undefined
  }
}

function uploadFieldKind(fieldType: string) {
  return uploadFieldTypes.has(fieldType) ? fieldType : undefined
}

function maxUploadCount(field: DataField): number {
  const value = Number(field.max_count || 0)
  return value > 0 ? value : 1
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

const optionFieldTypes = new Set([
  'radio',
  'checkbox',
  'select',
  'multi_select',
])
const uploadFieldKinds = ['image', 'video', 'audio'] as const
const uploadFieldTypes = new Set<string>(uploadFieldKinds)
