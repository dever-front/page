import { AxiosError } from 'axios'
import { toast } from 'sonner'

export function handleServerError(error: unknown) {
  let errMsg = 'Something went wrong!'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'Content not found.'
  }

  if (error instanceof AxiosError) {
    errMsg = resolveAxiosErrorMessage(error) || errMsg
  }

  toast.error(errMsg)
}

function resolveAxiosErrorMessage(error: AxiosError) {
  const data = error.response?.data
  if (!data) {
    return error.message
  }
  if (typeof data === 'string') {
    return data
  }
  if (typeof data !== 'object') {
    return error.message
  }

  const payload = data as Record<string, unknown>
  for (const field of ['title', 'message', 'error']) {
    const value = payload[field]
    if (typeof value === 'string' && value.trim() !== '') {
      return value
    }
  }
  return error.message
}
