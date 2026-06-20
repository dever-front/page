import type { WheelEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import type {
  AgentInteraction,
  AgentInteractionSubmitResult,
} from '@/lib/agent/types'
import { request } from '@/lib/request'
import { streamValueText as valueText } from '@/lib/stream'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import { Button } from '@/components/ui/button'
import {
  PowerParamField,
  buildDefaultParamValues,
  buildRequestInput,
  inputKeyForParam,
  isHiddenParam,
  normalizePowerParamConfig,
  normalizePowerParams,
  paramFilesRequestValue,
  summarizeParamDisplayValue,
  validateMainParams,
  type ParamFileMap,
  type ParamUploadedFile,
  type ParamValueMap,
  type PowerParam,
  type PowerParamOption,
} from './stream-request-params'

export type {
  AgentInteraction,
  AgentInteractionField,
  AgentInteractionOption,
  AgentInteractionSubmitResult,
} from '@/lib/agent/types'

type AgentInteractionPanelProps = {
  interaction: AgentInteraction
  paramApi?: string
  disabled?: boolean
  readonly?: boolean
  hideHeader?: boolean
  layout?: 'inline' | 'dialog'
  initialData?: Record<string, unknown>
  autoSubmitValid?: boolean
  onSubmit?: (result: AgentInteractionSubmitResult) => void
}

export function AgentInteractionPanel({
  interaction,
  paramApi = '/bot/admin/energon/power_params',
  disabled,
  readonly,
  hideHeader,
  layout = 'inline',
  initialData,
  autoSubmitValid,
  onSubmit,
}: AgentInteractionPanelProps) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [powerParams, setPowerParams] = useState<PowerParam[]>([])
  const [powerSourceTargetID, setPowerSourceTargetID] = useState('')
  const interactionType = normalizeText(interaction.type)
  const powerKey = normalizeText(interaction.power)
  const isPowerParams = interactionType === 'power_params'
  const formParams = useMemo(
    () => normalizeInteractionFields(interaction.fields),
    [interaction.fields]
  )
  const interactionValues = useMemo(
    () => normalizeInteractionValues(interaction),
    [interaction]
  )
  const params = isPowerParams ? powerParams : formParams
  const formKey = [
    interaction.id || '',
    interactionType,
    powerKey,
    readonly ? 'readonly' : 'edit',
    readonly ? JSON.stringify(initialData || {}) : '',
    powerSourceTargetID,
    JSON.stringify(interactionValues),
    params.map((param) => `${param.id}:${param.key}`).join('|'),
  ].join(':')

  useEffect(() => {
    let cancelled = false

    if (!isPowerParams) {
      return () => {
        cancelled = true
      }
    }

    async function loadPowerParams() {
      setLoading(true)
      setLoadError('')
      setPowerParams([])
      setPowerSourceTargetID('')

      if (!powerKey) {
        setLoading(false)
        setLoadError('交互缺少 power 参数。')
        return
      }

      const result = await request(paramApi, 'get', {
        power: powerKey,
        include_sources: 1,
      })
      if (cancelled) {
        return
      }
      if (result.code !== 0) {
        setLoading(false)
        setLoadError(result.message || '读取能力参数失败。')
        return
      }

      const config = normalizePowerParamConfig(result.data)
      setPowerParams(config.params)
      setPowerSourceTargetID(config.selectedSourceID)
      setLoading(false)
    }

    void loadPowerParams()
    return () => {
      cancelled = true
    }
  }, [isPowerParams, paramApi, powerKey])

  return (
    <div
      onWheel={handleInteractionPanelRootWheel}
      className={
        layout === 'dialog'
          ? 'flex min-h-0 flex-col bg-background'
          : 'shrink-0 rounded-md border bg-background'
      }
    >
      {!hideHeader ? (
        <div className='border-b px-3 py-2'>
          <div className='text-sm font-medium'>
            {normalizeText(interaction.title) || '需要补充信息'}
          </div>
          {normalizeText(interaction.description) ? (
            <div className='mt-0.5 text-xs leading-5 text-muted-foreground'>
              {normalizeText(interaction.description)}
            </div>
          ) : null}
        </div>
      ) : null}

      <AgentInteractionParamForm
        key={formKey}
        params={params}
        loading={isPowerParams ? loading : false}
        loadError={isPowerParams ? loadError : ''}
        powerKey={isPowerParams ? powerKey : ''}
        disabled={disabled}
        readonly={readonly}
        layout={layout}
        initialData={initialData}
        initialValues={interactionValues}
        autoSubmitValid={autoSubmitValid && isPowerParams}
        extraData={
          isPowerParams && powerSourceTargetID
            ? { source_target_id: powerSourceTargetID }
            : undefined
        }
        onSubmit={onSubmit}
      />
    </div>
  )
}

function AgentInteractionParamForm({
  params,
  loading,
  loadError,
  powerKey,
  disabled,
  readonly,
  layout,
  initialData,
  initialValues,
  autoSubmitValid,
  extraData,
  onSubmit,
}: {
  params: PowerParam[]
  loading: boolean
  loadError: string
  powerKey: string
  disabled?: boolean
  readonly?: boolean
  layout: 'inline' | 'dialog'
  initialData?: Record<string, unknown>
  initialValues?: Record<string, unknown>
  autoSubmitValid?: boolean
  extraData?: Record<string, unknown>
  onSubmit?: (result: AgentInteractionSubmitResult) => void
}) {
  const [error, setError] = useState('')
  const autoSubmittedRef = useRef(false)
  const [paramValues, setParamValues] = useState<ParamValueMap>(() =>
    buildInitialParamValues(params, initialValues)
  )
  const [paramFiles, setParamFiles] = useState<ParamFileMap>({})
  const visibleParams = useMemo(
    () => params.filter((param) => !isHiddenParam(param)),
    [params]
  )
  const uploadRuleIds = useMemo(
    () =>
      params
        .map((param) => Number(param.upload_rule_id || 0))
        .filter((ruleId) => Number.isFinite(ruleId) && ruleId > 0),
    [params]
  )
  const uploadRuleMetas = useUploadRuleMetas(uploadRuleIds)

  const setParamValue = (param: PowerParam, nextValue: unknown) => {
    const key = inputKeyForParam(param)
    if (!key) {
      return
    }
    setParamValues((current) => ({
      ...current,
      [key]: nextValue,
    }))
  }

  const setParamFileValue = (
    param: PowerParam,
    nextFiles: ParamUploadedFile[]
  ) => {
    const key = inputKeyForParam(param)
    if (!key) {
      return
    }
    setParamFiles((current) => ({
      ...current,
      [key]: nextFiles,
    }))
    setParamValues((current) => ({
      ...current,
      [key]: paramFilesRequestValue(param, nextFiles),
    }))
  }

  const buildSubmitResult = useCallback(():
    | AgentInteractionSubmitResult
    | string => {
    const validationError = validateMainParams(params, paramValues)
    if (validationError) {
      return validationError
    }

    const data = {
      ...(extraData || {}),
      ...buildRequestInput(params, paramValues),
    }
    return {
      data,
      text: summarizeSubmit(params, data, powerKey),
    }
  }, [extraData, paramValues, params, powerKey])

  useEffect(() => {
    if (
      !autoSubmitValid ||
      autoSubmittedRef.current ||
      readonly ||
      disabled ||
      loading ||
      loadError
    ) {
      return
    }

    const result = buildSubmitResult()
    if (typeof result === 'string') {
      return
    }
    autoSubmittedRef.current = true
    onSubmit?.(result)
  }, [
    autoSubmitValid,
    buildSubmitResult,
    disabled,
    loadError,
    loading,
    onSubmit,
    readonly,
  ])

  const submit = () => {
    const result = buildSubmitResult()
    if (typeof result === 'string') {
      setError(result)
      return
    }

    onSubmit?.(result)
  }

  if (readonly) {
    return (
      <div
        data-agent-interaction-scroll='true'
        onWheel={handleInteractionPanelWheel}
        className={
          layout === 'dialog'
            ? 'max-h-[62vh] space-y-2 overflow-y-auto overscroll-contain p-4'
            : 'max-h-[32vh] space-y-2 overflow-y-auto overscroll-contain p-3'
        }
      >
        {loading ? (
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-3.5 animate-spin' />
            正在读取参数...
          </div>
        ) : null}

        <div className='rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground'>
          交互信息已提交，只读查看。
        </div>

        <ReadonlyInteractionValues
          params={visibleParams}
          data={initialData || {}}
        />

        {loadError ? (
          <div className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {loadError}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div
        data-agent-interaction-scroll='true'
        onWheel={handleInteractionPanelWheel}
        className={
          layout === 'dialog'
            ? 'max-h-[62vh] space-y-3 overflow-y-auto overscroll-contain p-4'
            : 'max-h-[28vh] space-y-3 overflow-y-auto overscroll-contain p-3'
        }
      >
        {loading ? (
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-3.5 animate-spin' />
            正在读取参数...
          </div>
        ) : null}

        {!loading && visibleParams.length === 0 ? (
          <div className='text-sm text-muted-foreground'>
            当前没有需要填写的参数，可以直接继续。
          </div>
        ) : null}

        {visibleParams.map((param) => {
          const key = inputKeyForParam(param)
          return (
            <PowerParamField
              key={`${param.id}-${key}`}
              param={param}
              value={paramValues[key]}
              files={paramFiles[key] || []}
              uploadRuleMeta={uploadRuleMetas.get(
                Number(param.upload_rule_id || 0)
              )}
              disabled={disabled || loading}
              onChange={(nextValue) => setParamValue(param, nextValue)}
              onFilesChange={(nextFiles) => setParamFileValue(param, nextFiles)}
            />
          )
        })}

        {loadError || error ? (
          <div className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {loadError || error}
          </div>
        ) : null}
      </div>

      <div className='flex items-center justify-end gap-2 border-t px-3 py-2'>
        <Button
          type='button'
          size='sm'
          disabled={disabled || loading}
          onClick={submit}
        >
          <Send className='size-3.5' />
          提交并继续
        </Button>
      </div>
    </>
  )
}

function handleInteractionPanelRootWheel(event: WheelEvent<HTMLDivElement>) {
  const eventTarget = event.target
  if (
    eventTarget instanceof HTMLElement &&
    eventTarget.closest('[data-agent-interaction-scroll="true"]')
  ) {
    return
  }

  const scrollTarget = event.currentTarget.querySelector<HTMLDivElement>(
    '[data-agent-interaction-scroll="true"]'
  )
  if (!scrollTarget) {
    event.stopPropagation()
    return
  }

  scrollInteractionPanel(event, scrollTarget)
}

function handleInteractionPanelWheel(event: WheelEvent<HTMLDivElement>) {
  scrollInteractionPanel(event, event.currentTarget)
}

function scrollInteractionPanel(
  event: WheelEvent<HTMLDivElement>,
  target: HTMLDivElement
) {
  const scrollDelta = interactionPanelWheelDelta(event, target)
  if (scrollDelta === 0) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  target.scrollTop = Math.max(
    0,
    Math.min(
      target.scrollTop + scrollDelta,
      target.scrollHeight - target.clientHeight
    )
  )
}

function interactionPanelWheelDelta(
  event: WheelEvent<HTMLDivElement>,
  target: HTMLDivElement
) {
  if (event.deltaMode === 1) {
    return event.deltaY * 16
  }
  if (event.deltaMode === 2) {
    return event.deltaY * target.clientHeight
  }
  return event.deltaY
}

function ReadonlyInteractionValues({
  params,
  data,
}: {
  params: PowerParam[]
  data: Record<string, unknown>
}) {
  const renderedKeys = new Set<string>()
  const rows = params
    .map((param) => {
      const key = inputKeyForParam(param)
      if (!key || !(key in data)) {
        return null
      }
      renderedKeys.add(key)
      return {
        key,
        label: param.name || key,
        value: summarizeParamDisplayValue(param, data[key]),
      }
    })
    .filter(
      (row): row is { key: string; label: string; value: string } => row != null
    )

  for (const [key, value] of Object.entries(data)) {
    if (!renderedKeys.has(key) && !isInternalInteractionDataKey(key)) {
      rows.push({
        key,
        label: key,
        value: summarizeValue(value),
      })
    }
  }

  if (rows.length === 0) {
    return (
      <div className='rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground'>
        没有提交具体参数。
      </div>
    )
  }

  return (
    <div className='space-y-2'>
      {rows.map((row) => (
        <div
          key={row.key}
          className='rounded-md border bg-background px-3 py-2'
        >
          <div className='text-xs text-muted-foreground'>{row.label}</div>
          <div className='mt-1 text-sm leading-5 break-words whitespace-pre-wrap'>
            {row.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function normalizeInteractionValues(
  interaction: AgentInteraction
): Record<string, unknown> {
  return normalizeRecord(
    interaction.values ||
      interaction.default_values ||
      interaction.input ||
      interaction.params ||
      interaction.arguments ||
      interaction.data
  )
}

function buildInitialParamValues(
  params: PowerParam[],
  initialValues?: Record<string, unknown>
) {
  const values = {
    ...buildDefaultParamValues(params),
  }
  const provided = normalizeRecord(initialValues)
  for (const param of params) {
    const key = inputKeyForParam(param)
    if (!key) {
      continue
    }

    const providedValue = resolveInitialParamValue(param, provided)
    if (providedValue.exists) {
      values[key] = providedValue.value
      continue
    }

    if (isPromptParam(param)) {
      delete values[key]
    }
  }
  return values
}

function resolveInitialParamValue(
  param: PowerParam,
  provided: Record<string, unknown>
) {
  for (const key of initialParamLookupKeys(param)) {
    if (key in provided && !isInitialValueMissing(provided[key])) {
      return {
        exists: true,
        value: provided[key],
      }
    }
  }
  return {
    exists: false,
    value: undefined,
  }
}

function initialParamLookupKeys(param: PowerParam) {
  const keys = [
    inputKeyForParam(param),
    param.name,
    ...initialParamAliases(param),
  ]
  return [
    ...new Set(keys.map((key) => String(key || '').trim()).filter(Boolean)),
  ]
}

function initialParamAliases(param: PowerParam) {
  const key = inputKeyForParam(param)
  const name = String(param.name || '').trim()
  const aliases: string[] = []

  if (key === 'text' || name === '提示词') {
    aliases.push('prompt', 'message')
  }
  if (key === 'aspectRatio' || name === '比例') {
    aliases.push('ratio', 'aspect_ratio')
  }
  if (name === '分辨率') {
    aliases.push('resolution')
  }
  return aliases
}

function isPromptParam(param: PowerParam) {
  const key = inputKeyForParam(param)
  return key === 'text' || String(param.name || '').trim() === '提示词'
}

function isInitialValueMissing(value: unknown) {
  if (value == null) {
    return true
  }
  if (typeof value === 'string') {
    return value.trim() === ''
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return false
}

function isInternalInteractionDataKey(key: string) {
  return [
    'source_target_id',
    'sourceTargetId',
    'power_target_id',
    'powerTargetId',
    'target_id',
    'targetId',
  ].includes(key)
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {}
}

function normalizeInteractionFields(fields: unknown): PowerParam[] {
  if (!Array.isArray(fields)) {
    return []
  }

  return fields
    .map((field, index) => normalizeInteractionField(field, index))
    .filter((field): field is PowerParam => field != null)
    .sort((left, right) => Number(left.sort || 0) - Number(right.sort || 0))
}

function normalizeInteractionField(
  field: unknown,
  index: number
): PowerParam | null {
  if (!isPlainObject(field)) {
    return null
  }
  const key = normalizeText(
    field.key || field.name || field.label || `field_${index + 1}`
  )
  if (!key) {
    return null
  }
  const type = normalizeInteractionFieldType(field)
  const options = normalizeInteractionOptions(fieldOptionsSource(field))

  return {
    id: normalizeText(field.id || key) || `field_${index + 1}`,
    name: normalizeText(field.name || field.label || key),
    key,
    type: resolveInteractionControlType(type, field, options),
    usage: 1,
    value_type: normalizeInteractionValueType(field),
    default_value: normalizeDefaultValue(field),
    placeholder: normalizeText(field.placeholder),
    required: Boolean(field.required),
    upload_rule_id:
      normalizeID(field.upload_rule_id ?? field.uploadRuleId) ||
      defaultInteractionUploadRuleID(type, field),
    max_files: Number(field.max_files || 0),
    sort: Number(field.sort || index + 1),
    options,
  }
}

function defaultInteractionUploadRuleID(
  type: string,
  field: Record<string, unknown>
) {
  if (type !== 'file' && type !== 'files') {
    return undefined
  }
  const text = normalizeText(
    [
      field.type,
      field.key,
      field.name,
      field.label,
      field.placeholder,
      field.accept,
    ]
      .filter(Boolean)
      .join(' ')
  ).toLowerCase()
  if (/image|图片|截图|封面|海报|照片/.test(text)) {
    return 1
  }
  if (/video|视频|短视频|影片|素材片段/.test(text)) {
    return 2
  }
  if (/audio|音频|语音|声音|配音/.test(text)) {
    return 3
  }
  if (/pdf/.test(text)) {
    return 5
  }
  if (/office|word|excel|ppt|doc|docx|xls|xlsx|pptx/.test(text)) {
    return 4
  }
  return 6
}

function resolveInteractionControlType(
  type: string,
  field: Record<string, unknown>,
  options: PowerParamOption[]
) {
  if ((type === 'option' || type === 'multi_option') && options.length === 0) {
    return isBooleanInteractionField(field) ? 'switch' : 'input'
  }
  return type
}

function isBooleanInteractionField(field: Record<string, unknown>) {
  const text = normalizeText(
    field.name || field.label || field.key || field.placeholder
  )
  return /^(是否|要不要|需不需要|是否需要)/.test(text)
}

function fieldOptionsSource(field: Record<string, unknown>) {
  return (
    field.options ??
    field.option ??
    field.choices ??
    field.items ??
    field.enums ??
    field.enum
  )
}

function normalizeInteractionOptions(options: unknown): PowerParamOption[] {
  const rows = normalizeOptionRows(options)
  if (rows.length === 0) {
    return []
  }
  return rows
    .map((option, index) => {
      const optionRow = normalizeOptionRow(option, index)
      const label = normalizeText(optionRow.label)
      const value = optionRow.value == null ? label : optionRow.value
      const row: PowerParamOption = {
        id: normalizeID(optionRow.id) ?? index + 1,
        name: normalizeText(optionRow.name || label),
        value: label || String(index + 1),
        native_value: stringifyNativeValue(
          optionRow.native_value == null ? value : optionRow.native_value
        ),
        sort: Number(optionRow.sort || index + 1),
      }
      return row
    })
    .filter((option): option is PowerParamOption => option != null)
}

function normalizeOptionRows(options: unknown): unknown[] {
  if (Array.isArray(options)) {
    return options
  }
  if (isPlainObject(options)) {
    return Object.entries(options).map(([key, value]) => ({
      id: key,
      value,
    }))
  }
  return []
}

function normalizeOptionRow(option: unknown, index: number) {
  if (isPlainObject(option)) {
    const label = normalizeText(
      option.label || option.name || option.title || option.value || option.id
    )
    return {
      id: option.id,
      name: option.name,
      label: label || String(index + 1),
      value: option.value == null ? label : option.value,
      native_value: option.native_value ?? option.nativeValue,
      sort: option.sort,
    }
  }

  const label = normalizeText(option)
  return {
    id: label || index + 1,
    label: label || String(index + 1),
    value: option,
    native_value: option,
    sort: index + 1,
  }
}

function normalizeID(value: unknown): string | number | undefined {
  if (typeof value === 'string') {
    const text = value.trim()
    return text || undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return undefined
}

function normalizeInteractionFieldType(field: Record<string, unknown>) {
  const type = normalizeText(field.type)
  switch (type) {
    case 'radio':
    case 'chips':
    case 'choice':
    case 'select':
    case 'option':
      return 'option'
    case 'multi':
    case 'multiple':
    case 'checkbox':
    case 'checkboxes':
    case 'multi_select':
    case 'multiselect':
    case 'multi_option':
      return 'multi_option'
    case 'upload':
    case 'image':
    case 'file':
      return field.multiple || Number(field.max_files || 0) > 1
        ? 'files'
        : 'file'
    case 'uploads':
    case 'images':
    case 'files':
      return 'files'
    case 'textarea':
    case 'long_text':
    case 'text':
      return 'textarea'
    case 'bool':
    case 'boolean':
    case 'switch':
      return 'switch'
    case 'description':
      return 'description'
    default:
      return 'input'
  }
}

function normalizeInteractionValueType(field: Record<string, unknown>) {
  const valueType = normalizeText(
    field.value_type || field.valueType || field.type
  )
  return ['number', 'int', 'integer', 'float', 'double'].includes(valueType)
    ? 'number'
    : 'string'
}

function normalizeDefaultValue(field: Record<string, unknown>) {
  const value = field.default_value ?? field.default ?? field.value
  if (value == null) {
    return ''
  }
  if (Array.isArray(value) || isPlainObject(value)) {
    return JSON.stringify(value)
  }
  return String(value)
}

function summarizeSubmit(
  params: PowerParam[],
  data: Record<string, unknown>,
  powerKey: string
) {
  const parts = params
    .map((param) => {
      const key = inputKeyForParam(param)
      if (!key || !(key in data)) {
        return ''
      }
      return `${param.name || key}: ${summarizeParamDisplayValue(param, data[key])}`
    })
    .filter(Boolean)

  if (parts.length === 0) {
    return powerKey ? `已提交 ${powerKey} 能力参数。` : '已提交补充信息。'
  }
  return `已提交补充信息：${parts.join('；')}`
}

function summarizeValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join('、') : '空'
  }
  if (isPlainObject(value)) {
    return JSON.stringify(value)
  }
  return valueText(value) || '空'
}

function stringifyNativeValue(value: unknown) {
  if (value == null) {
    return ''
  }
  if (Array.isArray(value) || isPlainObject(value)) {
    return JSON.stringify(value)
  }
  return String(value)
}

function normalizeText(value: unknown) {
  return valueText(value).trim()
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
