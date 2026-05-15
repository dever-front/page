import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AssistantContextFieldGenerateButton,
  AssistantContextFormFillButton,
} from '@/components/assistant/form-actions'
import { isItemCurrentlyHidden } from '@/lib/condition'
import { getByPath, isScopedStorePath, setByPath } from '@/lib/path'
import { CONTROL_HIDDEN_WHEN_KEY } from '@/lib/page-control'
import { request } from '@/lib/request'
import { getStoreValueByPath, useStorePathValue } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useNodeOption } from '@/page/option'
import type { Item, OptionItem } from '@/lib/schema'
import type {
  AssistantFieldContext,
  AssistantPageContext,
} from '@/lib/assistant/context'
import { useAssistantContextRegistration } from '@/lib/assistant/use-context-registration'
import { FormInput } from './input'
import { FormRadio } from './radio'
import { FormSelect } from './select'
import { FormTextarea } from './textarea'
import type { NodeItemProps } from '../../nodes'

const typeEditorFieldRegistry = {
  'form-input': FormInput,
  'form-radio': FormRadio,
  'form-select': FormSelect,
  'form-textarea': FormTextarea,
} as const

type TypeOption = OptionItem & Record<string, any>
type TypeOptionGroup = {
  id: string
  value: string
  options: TypeOption[]
  grouped: boolean
}
type TypeRecord = Record<string, any>
type TypeEditorFieldItem = Item & { value: string }

export function TypeEditor({ item, value, setValue, option, store, layoutId }: NodeItemProps) {
  const meta = item.meta ?? {}
  const typeField = metaString(meta.typeField, 'type')
  const primaryKey = metaString(meta.primaryKey, 'id')
  const savePath = metaString(meta.savePath, '')
  const loadApi = metaString(meta.loadApi, '')
  const loadMethod = metaString(meta.loadMethod, 'get')
  const fields = useMemo(() => normalizeFields(meta.fields), [meta.fields])
  const controlledFields = useMemo(() => applyTypeEditorFieldControls(fields), [fields])
  const defaultRecord = useMemo(
    () => normalizeRecord(meta.defaultRecord),
    [meta.defaultRecord]
  )
  const typeOptionsFromPath = useStorePathValue(
    store,
    typeof meta.typeOptions === 'string' ? meta.typeOptions : undefined
  )
  const typeOptions = useMemo(
    () =>
      normalizeTypeOptions(
        Array.isArray(meta.typeOptions)
          ? meta.typeOptions
          : typeOptionsFromPath ?? option
      ),
    [meta.typeOptions, option, typeOptionsFromPath]
  )
  const typeOptionGroups = useMemo(() => groupTypeOptions(typeOptions), [typeOptions])
  const hasGroupedTypeOptions = typeOptionGroups.some((group) => group.grouped)
  const [localType, setLocalType] = useState('')
  const [records, setRecords] = useState<TypeRecord[]>([])
  const [draft, setDraft] = useState<TypeRecord>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const selectedType = metaString(value, localType)
  const contextSignature = useResolvedConfigSignature(store, meta.context)
  const loadParamsSignature = useResolvedConfigSignature(store, meta.loadParams)
  const context = useMemo(() => parseConfigSignature(contextSignature), [contextSignature])
  const loadParams = useMemo(() => parseConfigSignature(loadParamsSignature), [loadParamsSignature])
  const contextReady = meta.requiredContext === false || hasAllConfigValues(context)
  const selectedRecord = useMemo(
    () =>
      records.find(
        (record) => metaString(record[typeField], '') === selectedType
      ) ?? null,
    [records, selectedType, typeField]
  )
  const selectedRecordSignature = useMemo(
    () => JSON.stringify(selectedRecord ?? {}),
    [selectedRecord]
  )
  const selectedTypeOption = useMemo(
    () =>
      typeOptions.find((current) => String(current.id) === selectedType) ??
      null,
    [selectedType, typeOptions]
  )
  const selectedTypeDescription = metaString(
    selectedTypeOption?.description ||
      selectedTypeOption?.info ||
      selectedTypeOption?.desc,
    ''
  )
  const visibleFields = useMemo(
    () =>
      controlledFields.filter(
        (field) => !isItemCurrentlyHidden(field, { form: draft }, {})
      ),
    [controlledFields, draft]
  )
  const assistantContext = useMemo(
    () =>
      buildTypeEditorAssistantContext({
        store,
        item,
        fields: visibleFields,
        draft,
        selectedType,
        selectedTypeName: selectedTypeOption?.value,
        selectedTypeDescription,
      }),
    [
      draft,
      item,
      selectedType,
      selectedTypeDescription,
      selectedTypeOption?.value,
      store,
      visibleFields,
    ]
  )

  const commitType = useCallback(
    (nextType: string) => {
      if (item.value) {
        setValue(nextType)
        return
      }
      setLocalType(nextType)
    },
    [item.value, setValue]
  )

  useEffect(() => {
    if (selectedType || typeOptions.length === 0) {
      return
    }
    commitType(String(typeOptions[0].id))
  }, [commitType, selectedType, typeOptions])

  useEffect(() => {
    if (!loadApi || !contextReady) {
      setRecords([])
      setLoadError('')
      return
    }

    let alive = true
    setLoading(true)
    setLoadError('')
    request(loadApi, loadMethod, loadParams)
      .then((result) => {
        if (!alive) {
          return
        }
        if (result.code != null && result.code !== 0) {
          setRecords([])
          setLoadError(result.message || '加载失败')
          return
        }
        setRecords(normalizeRecords(result.data ?? result))
      })
      .finally(() => {
        if (alive) {
          setLoading(false)
        }
      })

    return () => {
      alive = false
    }
  }, [contextReady, loadApi, loadMethod, loadParamsSignature])

  useEffect(() => {
    if (!selectedType) {
      setDraft({})
      setErrors({})
      return
    }
    setDraft(buildDraftRecord(defaultRecord, selectedRecord, context, typeField, selectedType))
    setErrors({})
  }, [contextSignature, defaultRecord, selectedRecordSignature, selectedType, typeField])

  const setDraftValue = useCallback((fieldPath: string, nextValue: unknown) => {
    setDraft((current) => setByPath(current, fieldPath, nextValue))
    setErrors((current) => {
      if (!current[fieldPath]) {
        return current
      }
      const nextErrors = { ...current }
      delete nextErrors[fieldPath]
      return nextErrors
    })
  }, [])

  const applyAssistantValues = useCallback(
    (values: Record<string, unknown>) => {
      setDraft((current) => {
        let nextDraft = current
        for (const [path, nextValue] of Object.entries(values || {})) {
          nextDraft = setByPath(nextDraft, normalizeFieldPath(path), nextValue)
        }
        return nextDraft
      })
      setErrors((current) => clearAssistantAppliedErrors(current, values))
    },
    []
  )

  const applyAssistantFieldValue = useCallback(
    (path: string, nextValue: unknown) => {
      setDraftValue(normalizeFieldPath(path), nextValue)
    },
    [setDraftValue]
  )
  const activateAssistantContext = useAssistantContextRegistration({
    context: assistantContext,
    store,
    enabled: !!selectedType && contextReady,
    scope: 'page',
    route: assistantContext.route,
    name: String(item.id || item.name || 'type-editor'),
    applyFormValues: applyAssistantValues,
  })

  const saveRecord = async () => {
    if (!selectedType) {
      toast.error('请先选择类型。')
      return
    }
    if (!savePath) {
      toast.error('保存失败：未配置保存路径。')
      return
    }
    if (!contextReady) {
      toast.error('保存失败：缺少上下文参数。')
      return
    }

    const nextErrors = validateFields(visibleFields, draft)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      toast.error(Object.values(nextErrors)[0] || '请检查表单。')
      return
    }

    const payload = buildSavePayload({
      context,
      defaultRecord,
      draft,
      primaryKey,
      record: selectedRecord,
      typeField,
      selectedType,
    })

    setSaving(true)
    try {
      const result = await request(`/front/route/action?path=${savePath}`, 'post', {
        action: {
          type: 'save',
          before: meta.saveBefore,
          upsert: meta.upsert === true,
        },
        payload,
      })
      if (result.code != null && result.code !== 0) {
        toast.error(result.message || '保存失败。')
        return
      }

      const savedID = readSavedPrimaryKey(result.data, primaryKey, payload[primaryKey])
      const savedRecord = {
        ...payload,
        [primaryKey]: savedID || payload[primaryKey],
        value: payload.name || selectedTypeOption?.value || selectedType,
      }
      setRecords((current) => upsertTypeRecord(current, savedRecord, primaryKey, typeField))
      setDraft(buildDraftRecord(defaultRecord, savedRecord, context, typeField, selectedType))
      toast.success(selectedRecord ? '已保存。' : '已新增。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="grid min-h-[calc(100vh-13rem)] gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]"
      onFocusCapture={activateAssistantContext}
      onPointerDownCapture={activateAssistantContext}
    >
      <div className="min-w-0 rounded-md border bg-background">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">
            {metaString(meta.typeTitle, '类型')}
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {metaString(meta.typeDescription, '左侧选择类型，右侧维护对应内容。')}
          </div>
        </div>
        <div className={cn('p-2', hasGroupedTypeOptions ? 'space-y-3' : 'space-y-1')}>
          {typeOptionGroups.map((group) => (
            <div key={group.id} className={cn('space-y-1', hasGroupedTypeOptions && 'pt-1')}>
              {hasGroupedTypeOptions ? (
                <div className="flex h-7 items-center px-3 text-xs font-medium text-muted-foreground">
                  {group.value}
                </div>
              ) : null}
              <div
                className={cn(
                  'space-y-1',
                  hasGroupedTypeOptions && 'ml-3 border-l border-border/70 pl-3'
                )}
              >
                {group.options.map((typeOption) => {
                  const typeID = String(typeOption.id)
                  const configured = records.some(
                    (record) => metaString(record[typeField], '') === typeID
                  )
                  const active = typeID === selectedType
                  return (
                    <button
                      key={typeID}
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        active
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      )}
                      onClick={() => commitType(typeID)}
                    >
                      <span className="min-w-0 truncate">{typeOption.value}</span>
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          configured ? 'bg-emerald-500' : 'bg-muted-foreground/25'
                        )}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 rounded-md border bg-background">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-base font-semibold">
              <span>{selectedTypeOption?.value || '内容'}</span>
              {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {selectedTypeDescription ||
                (selectedRecord
                  ? '已配置，可直接修改后保存。'
                  : '当前类型暂无内容，保存后会新增。')}
            </div>
          </div>
          <AssistantContextFormFillButton
            context={assistantContext}
            variant="outline"
            size="sm"
            disabled={saving || loading || !selectedType || !contextReady}
            onApplyValues={applyAssistantValues}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void saveRecord()}
            disabled={saving || loading || !selectedType || !contextReady}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            保存
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {!contextReady ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              缺少上下文参数，无法编辑。
            </div>
          ) : loadError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {loadError}
            </div>
          ) : null}

          {visibleFields.map((field) => {
            const fieldPath = normalizeFieldPath(field.value)
            return (
              <TypeEditorField
                key={field.id || field.value}
                field={field}
                value={getByPath(draft, fieldPath)}
                error={errors[fieldPath]}
                store={store}
                layoutId={layoutId}
                assistantContext={assistantContext}
                assistantDisabled={saving || loading || !selectedType || !contextReady}
                onAssistantApplyValue={applyAssistantFieldValue}
                onChange={(nextValue) => setDraftValue(fieldPath, nextValue)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TypeEditorField({
  field,
  value,
  error,
  store,
  layoutId,
  assistantContext,
  assistantDisabled,
  onAssistantApplyValue,
  onChange,
}: {
  field: TypeEditorFieldItem
  value: unknown
  error?: string
  store: NodeItemProps['store']
  layoutId: string
  assistantContext: AssistantPageContext
  assistantDisabled: boolean
  onAssistantApplyValue: (path: string, value: unknown) => void
  onChange: (value: unknown) => void
}) {
  const fieldType = field.type as keyof typeof typeEditorFieldRegistry
  const FieldComponent = typeEditorFieldRegistry[fieldType] || FormInput
  const { option, optionLoading, ensureOptionLoaded } = useNodeOption(store, field.option, field)
  const required = field.validate?.some((rule) => rule.type === 'required')
  const fieldPath = normalizeFieldPath(field.value)
  const assistantField = buildTypeEditorAssistantField(field)
  const assistantAdornment = isTypeEditorFieldGeneratable(field) ? (
    <AssistantContextFieldGenerateButton
      context={assistantContext}
      field={assistantField}
      className={resolveTypeEditorAssistantButtonClass(field)}
      disabled={assistantDisabled || !!field.meta?.disabled}
      onApplyValue={onAssistantApplyValue}
    />
  ) : null

  return (
    <div className="grid gap-x-4 gap-y-1 md:grid-cols-[8rem_minmax(0,1fr)]">
      <div className="md:flex md:min-h-10 md:items-center">
        <Label htmlFor={field.id} className={cn('text-sm font-medium', error && 'text-destructive')}>
          <span className="inline-flex items-center gap-1.5">
            <span>{field.name || field.placeholder || fieldPath}</span>
            {required ? <span className="text-destructive">*</span> : null}
          </span>
        </Label>
      </div>
      <div className="min-w-0">
        <FieldComponent
          item={{
            ...field,
            id: field.id || `type-editor-${fieldPath}`,
            mode: 'form',
            value: `form.${fieldPath}`,
            meta: {
              ...field.meta,
              controlClassName: field.meta?.controlClassName,
            },
          }}
          value={value}
          setValue={onChange}
          option={option}
          optionLoading={optionLoading}
          ensureOptionLoaded={ensureOptionLoaded}
          error={error}
          store={store}
          layoutId={layoutId}
          runAction={async () => {}}
          assistantAdornment={assistantAdornment}
        />
        {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
        {field.info ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{field.info}</p>
        ) : null}
      </div>
    </div>
  )
}

function isTypeEditorFieldGeneratable(field: TypeEditorFieldItem) {
  if (field.meta?.assistant === false || field.meta?.aiGenerate === false) {
    return false
  }
  return field.type === 'form-input' || field.type === 'form-textarea'
}

function resolveTypeEditorAssistantButtonClass(field: TypeEditorFieldItem) {
  if (field.type === 'form-textarea') {
    return 'absolute right-2 top-2 bg-background/80'
  }
  return 'absolute right-1 top-1/2 -translate-y-1/2'
}

function buildTypeEditorAssistantContext({
  store,
  item,
  fields,
  draft,
  selectedType,
  selectedTypeName,
  selectedTypeDescription,
}: {
  store: NodeItemProps['store']
  item: NodeItemProps['item']
  fields: TypeEditorFieldItem[]
  draft: TypeRecord
  selectedType: string
  selectedTypeName?: string
  selectedTypeDescription?: string
}): AssistantPageContext {
  const state = store.getState()
  const assistantFields = fields.map(buildTypeEditorAssistantField)
  return {
    scope: 'page',
    route: state.pagePath || state.schema.page.route || '',
    page: {
      name: `${state.schema.page.name || state.schema.page.title || item.name || '当前页面'} - ${
        selectedTypeName || selectedType || '当前类型'
      }`,
      title: selectedTypeDescription || state.schema.page.title || item.name,
    },
    form: {
      fields: assistantFields,
      values: collectTypeEditorAssistantValues(assistantFields, draft),
    },
  }
}

function buildTypeEditorAssistantField(field: TypeEditorFieldItem): AssistantFieldContext {
  const assistantField: AssistantFieldContext = {
    path: `form.${normalizeFieldPath(field.value)}`,
    name: String(field.name || field.placeholder || field.value || '').trim(),
    type: String(field.type || 'form-input').trim(),
  }
  if (field.placeholder) {
    assistantField.placeholder = field.placeholder
  }
  if (field.info) {
    assistantField.info = field.info
  }
  if (field.validate?.some((rule) => rule.type === 'required')) {
    assistantField.required = true
  }
  if (Array.isArray(field.option)) {
    assistantField.options = field.option
  }
  return assistantField
}

function collectTypeEditorAssistantValues(
  fields: AssistantFieldContext[],
  draft: TypeRecord
) {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    const value = getByPath(draft, normalizeFieldPath(field.path))
    if (!hasMeaningfulValue(value)) {
      continue
    }
    values[field.path] = value
  }
  return values
}

function clearAssistantAppliedErrors(
  errors: Record<string, string>,
  values: Record<string, unknown>
) {
  const nextErrors = { ...errors }
  for (const path of Object.keys(values || {})) {
    delete nextErrors[normalizeFieldPath(path)]
  }
  return nextErrors
}

function useResolvedConfigSignature(store: NodeItemProps['store'], config: unknown) {
  return useStore(store, () => JSON.stringify(resolveConfigValue(store, config) ?? {}))
}

function resolveConfigValue(store: NodeItemProps['store'], value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveConfigValue(store, item))
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveConfigValue(store, item)])
    )
  }
  if (typeof value === 'string' && isScopedStorePath(value)) {
    return normalizeScalarValue(getStoreValueByPath(store, value))
  }
  return value
}

function parseConfigSignature(signature: string): Record<string, any> {
  try {
    const parsed = JSON.parse(signature)
    return isPlainObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function buildDraftRecord(
  defaultRecord: TypeRecord,
  record: TypeRecord | null,
  context: TypeRecord,
  typeField: string,
  selectedType: string
) {
  return {
    ...defaultRecord,
    ...(record ?? {}),
    ...context,
    [typeField]: selectedType,
  }
}

function buildSavePayload({
  context,
  defaultRecord,
  draft,
  primaryKey,
  record,
  selectedType,
  typeField,
}: {
  context: TypeRecord
  defaultRecord: TypeRecord
  draft: TypeRecord
  primaryKey: string
  record: TypeRecord | null
  selectedType: string
  typeField: string
}) {
  const payload = {
    ...defaultRecord,
    ...(record ?? {}),
    ...context,
    ...draft,
    [typeField]: selectedType,
  }
  if (record?.[primaryKey] != null && String(record[primaryKey]).trim() !== '') {
    payload[primaryKey] = record[primaryKey]
  }
  return payload
}

function validateFields(fields: TypeEditorFieldItem[], draft: TypeRecord) {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const fieldPath = normalizeFieldPath(field.value)
    const value = getByPath(draft, fieldPath)
    const requiredRule = field.validate?.find((rule) => rule.type === 'required')
    if (requiredRule && !hasMeaningfulValue(value)) {
      errors[fieldPath] = requiredRule.message || `${field.name || fieldPath}不能为空。`
    }
  }
  return errors
}

function upsertTypeRecord(
  records: TypeRecord[],
  nextRecord: TypeRecord,
  primaryKey: string,
  typeField: string
) {
  const nextType = metaString(nextRecord[typeField], '')
  const nextID = metaString(nextRecord[primaryKey], '')
  let updated = false
  const result = records.map((record) => {
    const sameID = nextID && metaString(record[primaryKey], '') === nextID
    const sameType = nextType && metaString(record[typeField], '') === nextType
    if (!sameID && !sameType) {
      return record
    }
    updated = true
    return nextRecord
  })
  return updated ? result : [...result, nextRecord]
}

function readSavedPrimaryKey(data: unknown, primaryKey: string, fallback: unknown) {
  if (isPlainObject(data)) {
    return data[primaryKey] ?? data.id ?? fallback
  }
  return fallback
}

function normalizeFields(value: unknown): TypeEditorFieldItem[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((field): field is TypeEditorFieldItem => isPlainObject(field) && typeof field.value === 'string')
    .map((field, index) => ({
      ...field,
      id: field.id || `type-editor-field-${index}`,
      type: field.type || 'form-input',
      value: normalizeFieldPath(field.value),
    }))
}

type TypeEditorControlOperator =
  | 'equals'
  | 'notEquals'
  | 'empty'
  | 'notEmpty'
  | 'includes'
  | 'notIncludes'

type TypeEditorControlRule = {
  operator?: TypeEditorControlOperator
  value?: unknown
  hide?: string | string[]
}

function applyTypeEditorFieldControls(fields: TypeEditorFieldItem[]) {
  const clonedFields = fields.map((field) => ({
    ...field,
    meta: field.meta ? { ...field.meta } : {},
  }))
  const fieldByID = new Map(
    clonedFields
      .filter((field) => field.id)
      .map((field) => [String(field.id), field])
  )

  for (const field of clonedFields) {
    const rules = normalizeTypeEditorControlRules(field.meta?.control)
    if (!rules.length || !field.value) {
      continue
    }

    for (const rule of rules) {
      const targetIDs = normalizeControlTargetIDs(rule.hide)
      if (!targetIDs.length) {
        continue
      }

      const condition = {
        path: `form.${normalizeFieldPath(field.value)}`,
        operator: rule.operator ?? resolveDefaultTypeEditorControlOperator(field),
        value: rule.value,
      }
      for (const targetID of targetIDs) {
        const target = fieldByID.get(targetID)
        if (target) {
          appendTypeEditorHiddenCondition(target, condition)
        }
      }
    }
  }

  return clonedFields
}

function normalizeTypeEditorControlRules(value: unknown): TypeEditorControlRule[] {
  if (Array.isArray(value)) {
    return value.filter(isTypeEditorControlRule)
  }
  return isTypeEditorControlRule(value) ? [value] : []
}

function isTypeEditorControlRule(value: unknown): value is TypeEditorControlRule {
  return isPlainObject(value)
}

function normalizeControlTargetIDs(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => metaString(item, '')).filter(Boolean)))
  }
  const single = metaString(value, '')
  return single ? [single] : []
}

function resolveDefaultTypeEditorControlOperator(
  field: TypeEditorFieldItem
): TypeEditorControlOperator {
  if (field.type === 'form-checkbox') {
    return 'includes'
  }
  if (field.type === 'form-select' && field.meta?.multiple === true) {
    return 'includes'
  }
  return 'equals'
}

function appendTypeEditorHiddenCondition(
  field: TypeEditorFieldItem,
  condition: {
    path: string
    operator: TypeEditorControlOperator
    value?: unknown
  }
) {
  const meta = field.meta ?? {}
  const current = Array.isArray(meta[CONTROL_HIDDEN_WHEN_KEY])
    ? meta[CONTROL_HIDDEN_WHEN_KEY]
    : []
  field.meta = {
    ...meta,
    [CONTROL_HIDDEN_WHEN_KEY]: [...current, condition],
  }
}

function normalizeTypeOptions(value: unknown): TypeOption[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((entry) => {
      if (!isPlainObject(entry)) {
        return null
      }
      const id = entry.id
      if (id == null || String(id).trim() === '') {
        return null
      }
      return {
        ...entry,
        id,
        value: metaString(entry.value ?? entry.name ?? entry.label, String(id)),
      } as TypeOption
    })
    .filter((entry): entry is TypeOption => !!entry)
}

function groupTypeOptions(options: TypeOption[]): TypeOptionGroup[] {
  const hasGroup = options.some((option) => typeOptionGroupID(option) !== '')
  if (!hasGroup) {
    return [
      {
        id: '__default__',
        value: '',
        options,
        grouped: false,
      },
    ]
  }

  const groups: TypeOptionGroup[] = []
  const groupByID = new Map<string, TypeOptionGroup>()
  for (const option of options) {
    const groupID = typeOptionGroupID(option) || '__ungrouped__'
    const groupValue =
      metaString(option.groupValue ?? option.groupLabel ?? option.groupName, '') ||
      (groupID === '__ungrouped__' ? '未分组' : groupID)
    let group = groupByID.get(groupID)
    if (!group) {
      group = {
        id: groupID,
        value: groupValue,
        options: [],
        grouped: true,
      }
      groupByID.set(groupID, group)
      groups.push(group)
    }
    group.options.push(option)
  }
  return groups
}

function typeOptionGroupID(option: TypeOption) {
  return metaString(option.group ?? option.groupId ?? option.group_id, '')
}

function normalizeRecords(value: unknown): TypeRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((record): record is TypeRecord => isPlainObject(record))
}

function normalizeRecord(value: unknown): TypeRecord {
  return isPlainObject(value) ? { ...value } : {}
}

function normalizeFieldPath(value: unknown) {
  return metaString(value, '')
    .replace(/^data\.form\./, '')
    .replace(/^form\./, '')
}

function hasAllConfigValues(value: Record<string, any>) {
  return Object.values(value).every(hasMeaningfulValue)
}

function hasMeaningfulValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return value != null && String(value).trim() !== ''
}

function normalizeScalarValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value
}

function metaString(value: unknown, fallback: string) {
  const text = String(value ?? '').trim()
  return text || fallback
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
