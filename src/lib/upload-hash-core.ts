import { sha256 } from '@noble/hashes/sha2'

export const UPLOAD_HASH_CHUNK_BYTES = 4 * 1024 * 1024
export const UPLOAD_HASH_HEX_LENGTH = 32

export type UploadHashWorkerRequest = {
  file: File
}

export type UploadHashWorkerResponse = {
  hash?: string
  error?: string
}

export async function digestUploadBlobInChunks(
  blob: Blob,
  afterChunk?: () => void | Promise<void>
) {
  const hasher = sha256.create()
  for (let offset = 0; offset < blob.size; offset += UPLOAD_HASH_CHUNK_BYTES) {
    const bytes = new Uint8Array(
      await blob.slice(offset, offset + UPLOAD_HASH_CHUNK_BYTES).arrayBuffer()
    )
    hasher.update(bytes)
    await afterChunk?.()
  }
  return uploadHashBytesToHex(hasher.digest())
}

export function uploadHashBytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, UPLOAD_HASH_HEX_LENGTH)
}
