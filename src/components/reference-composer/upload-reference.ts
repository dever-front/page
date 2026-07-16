import { resolveAssetUrl } from '@/lib/request'
import type { UploadFileItem } from '@/lib/upload'
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
      const refID = Number(file.id || 0)
      if (!refID) {
        return null
      }
      const kind = String(file.kind || fallbackKind || 'file').trim()
      const url = resolveAssetUrl(
        String(file.thumbnail || file.url || file.open_url || '').trim()
      )
      return {
        key: `upload_file:${refID}:${usage}`,
        refType: 'upload_file' as const,
        refId: refID,
        label: String(file.name || `文件 ${refID}`).trim(),
        description: description || undefined,
        usage,
        preview: { kind, url },
      }
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option))
}
