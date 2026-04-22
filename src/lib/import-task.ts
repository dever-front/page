import { request } from './request'

export type ImportFieldInfo = {
  field: string
  label: string
  kind: string
  multiple?: boolean
  missingPolicy?: string
  saveMode?: string
  uploadKind?: string
  uploadRuleId?: number
  sourceMode?: string
  baseDir?: string
  tip?: string
  aliases?: string[]
}

export type ImportMatchFieldInfo = {
  field: string
  label: string
}

export type ImportColumnInfo = {
  index: number
  header: string
  sample: string
  mappedField: string
}

export type ImportAnalyzeResult = {
  name: string
  model: string
  upload_rule_id: number
  file: {
    id: number
    name: string
  }
  sheets: string[]
  sheet_name: string
  columns: ImportColumnInfo[]
  fields: ImportFieldInfo[]
  match_fields: string[]
  match_mode: string
  match_options: ImportMatchFieldInfo[]
}

export type ImportTaskInfo = {
  id: number
  status: string
  progress: number
  stage: string
  total_rows: number
  success_rows: number
  failed_rows: number
  summary?: Record<string, any>
  error_message?: string
}

export type ImportMapping = {
  columnIndex: number
  field: string
}

export async function analyzeImportFile(params: {
  path: string
  importKey: string
  fileId: number
  sheetName?: string
}) {
  const result = await request('/front/import/analyze', 'post', {
    path: params.path,
    importKey: params.importKey,
    fileId: params.fileId,
    sheetName: params.sheetName || '',
  })

  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '分析导入文件失败')
  }

  return normalizeImportAnalyzeResult(result.data)
}

export async function createImportTask(params: {
  path: string
  importKey: string
  fileId: number
  sheetName: string
  mappings: ImportMapping[]
  matchFields: string[]
  matchMode: string
  fieldSettings?: Record<string, { missingPolicy?: string; sourceMode?: string; baseDir?: string }>
}) {
  const result = await request('/front/import/task_create', 'post', {
    path: params.path,
    importKey: params.importKey,
    fileId: params.fileId,
    sheetName: params.sheetName,
    mappings: JSON.stringify(params.mappings || []),
    matchFields: JSON.stringify(params.matchFields || []),
    matchMode: params.matchMode || '',
    fieldSettings: JSON.stringify(params.fieldSettings || {}),
  })

  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '创建导入任务失败')
  }

  return normalizeImportTaskInfo(result.data)
}

export async function getImportTaskInfo(taskId: number) {
  const result = await request('/front/import/task_info', 'get', { id: taskId })
  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '获取导入任务失败')
  }
  return normalizeImportTaskInfo(result.data)
}

function normalizeImportAnalyzeResult(raw: any): ImportAnalyzeResult {
  return {
    name: String(raw?.name || '').trim(),
    model: String(raw?.model || '').trim(),
    upload_rule_id: Number(raw?.upload_rule_id || 0),
    file: {
      id: Number(raw?.file?.id || 0),
      name: String(raw?.file?.name || '').trim(),
    },
    sheets: Array.isArray(raw?.sheets)
      ? raw.sheets.map((item: any) => String(item || '').trim()).filter(Boolean)
      : [],
    sheet_name: String(raw?.sheet_name || '').trim(),
    columns: Array.isArray(raw?.columns)
      ? raw.columns.map((item: any) => ({
          index: Number(item?.index || 0),
          header: String(item?.header || '').trim(),
          sample: String(item?.sample || '').trim(),
          mappedField: String(item?.mappedField || '').trim(),
        }))
      : [],
    fields: Array.isArray(raw?.fields)
      ? raw.fields.map((item: any) => ({
          field: String(item?.field || '').trim(),
          label: String(item?.label || '').trim(),
          kind: String(item?.kind || '').trim(),
          multiple: !!item?.multiple,
          missingPolicy: String(item?.missingPolicy || '').trim(),
          saveMode: String(item?.saveMode || '').trim(),
          uploadKind: String(item?.uploadKind || '').trim(),
          uploadRuleId: Number(item?.uploadRuleId || 0),
          sourceMode: String(item?.sourceMode || '').trim(),
          baseDir: String(item?.baseDir || '').trim(),
          tip: String(item?.tip || '').trim(),
          aliases: Array.isArray(item?.aliases)
            ? item.aliases.map((value: any) => String(value || '').trim()).filter(Boolean)
            : [],
        }))
      : [],
    match_fields: Array.isArray(raw?.match_fields)
      ? raw.match_fields.map((item: any) => String(item || '').trim()).filter(Boolean)
      : [],
    match_mode: String(raw?.match_mode || '').trim(),
    match_options: Array.isArray(raw?.match_options)
      ? raw.match_options
          .map((item: any) => ({
            field: String(item?.field || '').trim(),
            label: String(item?.label || '').trim(),
          }))
          .filter((item: ImportMatchFieldInfo) => item.field)
      : [],
  }
}

function normalizeImportTaskInfo(raw: any): ImportTaskInfo {
  return {
    id: Number(raw?.id || 0),
    status: String(raw?.status || '').trim(),
    progress: Number(raw?.progress || 0),
    stage: String(raw?.stage || '').trim(),
    total_rows: Number(raw?.total_rows || 0),
    success_rows: Number(raw?.success_rows || 0),
    failed_rows: Number(raw?.failed_rows || 0),
    summary: raw?.summary && typeof raw.summary === 'object' ? raw.summary : {},
    error_message: String(raw?.error_message || '').trim(),
  }
}
