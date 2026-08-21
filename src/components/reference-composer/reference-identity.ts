import type { UploadFileItem } from '@/lib/upload'
import type { ReferenceType } from './types'

export type ReferenceFileIdentity =
  | {
      refType: 'asset'
      refId: number
      versionID: number
      key: string
    }
  | {
      refType: 'material' | 'upload_file'
      refId: number
      key: string
    }

export function referenceIdentity(
  refType: ReferenceType | string | undefined,
  refId: number | string | undefined
) {
  const type = String(refType || '').trim()
  const id = positiveInteger(refId)
  return type && id ? `${type}:${id}` : ''
}

export function referenceFileIdentity(
  value: UploadFileItem['id']
): ReferenceFileIdentity | null {
  const text = String(value || '').trim()
  const assetMatch = /^asset:([1-9]\d*):([1-9]\d*)$/.exec(text)
  if (assetMatch) {
    const refId = Number(assetMatch[1])
    return {
      refType: 'asset',
      refId,
      versionID: Number(assetMatch[2]),
      key: referenceIdentity('asset', refId),
    }
  }
  const materialMatch = /^material:([1-9]\d*)$/.exec(text)
  if (materialMatch) {
    const refId = Number(materialMatch[1])
    return {
      refType: 'material',
      refId,
      key: referenceIdentity('material', refId),
    }
  }
  const refId = positiveInteger(value)
  return refId
    ? {
        refType: 'upload_file',
        refId,
        key: referenceIdentity('upload_file', refId),
      }
    : null
}

function positiveInteger(value: unknown) {
  const number = Number(value || 0)
  return Number.isSafeInteger(number) && number > 0 ? number : 0
}
