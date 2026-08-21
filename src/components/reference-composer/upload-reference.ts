import { resolveAssetUrl } from '@/lib/request'
import type { UploadFileItem } from '@/lib/upload'
import { referenceFileIdentity } from './reference-identity'
import type { ReferenceOption } from './types'

export function uploadFileReferenceOptions(
  files: UploadFileItem[],
  {
    usage = '',
    description = '',
    fallbackKind = 'file',
  }: {
    usage?: string
    description?: string
    fallbackKind?: string
  } = {}
): ReferenceOption[] {
  return files
    .map((file) => {
      const identity = referenceFileIdentity(file.id)
      if (!identity) {
        return null
      }
      const kind = String(file.kind || fallbackKind || 'file').trim()
      const mediaURL = resolveAssetUrl(
        String(file.url || file.open_url || '').trim()
      )
      const url = resolveAssetUrl(
        String(file.thumbnail || file.url || file.open_url || '').trim()
      )
      if (identity.refType === 'material') {
        return {
          key: `material:${identity.refId}:${usage}`,
          refType: 'material' as const,
          refId: identity.refId,
          label: String(file.name || `官方素材 ${identity.refId}`).trim(),
          description: description || undefined,
          usage,
          mediaURL: mediaURL || undefined,
          preview: { kind, url },
        }
      }
      if (identity.refType === 'asset') {
        return {
          key: `asset:${identity.refId}:${identity.versionID}:${usage}`,
          refType: 'asset' as const,
          refId: identity.refId,
          label: String(file.name || `资产 ${identity.refId}`).trim(),
          description: description || undefined,
          usage,
          versionID: identity.versionID,
          mediaURL: mediaURL || undefined,
          preview: { kind, url },
        }
      }
      return {
        key: `upload_file:${identity.refId}:${usage}`,
        refType: 'upload_file' as const,
        refId: identity.refId,
        label: String(file.name || `文件 ${identity.refId}`).trim(),
        description: description || undefined,
        usage,
        preview: { kind, url },
      }
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option))
}
