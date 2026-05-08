import { requestRaw } from './request'

export type RuntimeStreamFrame<TOutput = Record<string, any>> = {
  request_id?: string
  stream_id?: string
  type?: string
  output?: TOutput
  msg?: string
  status?: number
}

export async function readRuntimeStreamFrame<TOutput = Record<string, any>>(
  api: string,
  requestID: string,
  lastID: string,
  blockMs = 1000
) {
  return (await requestRaw(api, 'get', {
    request_id: requestID,
    last_id: lastID,
    block: blockMs,
  })) as RuntimeStreamFrame<TOutput>
}

export function assertRuntimeStreamFrameSuccess(frame: any) {
  if (Number(frame?.status) === 2) {
    throw new Error(streamValueText(frame?.msg) || '请求失败。')
  }
}

export function streamValueText(value: any) {
  if (value == null) {
    return ''
  }
  return typeof value === 'string' ? value : String(value)
}
