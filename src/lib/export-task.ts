import { request, requestBlob } from './request'

export type ExportTaskInfo = {
  id: number
  status: string
  progress: number
  stage: string
  result_name?: string
  error_message?: string
}

export async function createExportTask(params: {
  path: string
  tableId?: string
  exportKey: string
  query: Record<string, string>
}) {
  const result = await request('/front/export/task_create', 'post', {
    path: params.path,
    tableId: params.tableId,
    exportKey: params.exportKey,
    query: JSON.stringify(params.query || {}),
  })

  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '创建导出任务失败')
  }

  return normalizeExportTaskInfo(result.data)
}

export async function getExportTaskInfo(taskId: number) {
  const result = await request('/front/export/task_info', 'get', { id: taskId })
  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '获取导出任务失败')
  }
  return normalizeExportTaskInfo(result.data)
}

export async function downloadExportTask(task: ExportTaskInfo) {
  const blob = await requestBlob('/front/export/download', 'get', { id: task.id })
  if (!blob) {
    throw new Error('下载导出文件失败')
  }

  const filename = String(task.result_name || `export-${task.id}.xlsx`).trim()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename || `export-${task.id}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export function readCurrentExportQuery() {
  if (typeof window === 'undefined') {
    return {}
  }

  return Object.fromEntries(
    Array.from(new URLSearchParams(window.location.search).entries()).map(([key, value]) => [
      key,
      String(value || '').trim(),
    ])
  )
}

function normalizeExportTaskInfo(raw: any): ExportTaskInfo {
  return {
    id: Number(raw?.id || 0),
    status: String(raw?.status || '').trim(),
    progress: Number(raw?.progress || 0),
    stage: String(raw?.stage || '').trim(),
    result_name: String(raw?.result_name || '').trim(),
    error_message: String(raw?.error_message || '').trim(),
  }
}
