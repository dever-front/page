import { toast } from 'sonner'

type ActionResultLike = {
  success: boolean
  message?: string
}

type ActionToastOptions = {
  successMessage?: unknown
  errorMessage?: unknown
  defaultSuccessMessage?: string
  defaultErrorMessage?: string
}

export function toastActionResult(
  result: ActionResultLike,
  options: ActionToastOptions = {}
) {
  if (result.success) {
    const message = pickSuccessToastMessage(result, options)
    if (message) {
      toast.success(message)
    }
    return
  }

  const message = pickToastMessage(
    options.errorMessage,
    result.message,
    options.defaultErrorMessage || '操作失败'
  )
  if (message) {
    toast.error(message)
  }
}

function pickSuccessToastMessage(
  result: ActionResultLike,
  options: ActionToastOptions
) {
  const explicitMessage = pickToastMessage(options.successMessage)
  if (explicitMessage) {
    return explicitMessage
  }

  const defaultMessage = String(options.defaultSuccessMessage || '操作成功').trim()
  const backendMessage = pickToastMessage(result.message)
  if (isGenericSuccessMessage(backendMessage)) {
    return defaultMessage
  }

  return backendMessage || defaultMessage
}

function pickToastMessage(...values: unknown[]) {
  for (const current of values) {
    const message = String(current ?? '').trim()
    if (message) {
      return message
    }
  }

  return ''
}

function isGenericSuccessMessage(message: string) {
  const normalized = message.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return ['success', 'ok', 'done', 'true', '操作成功', '请求成功'].includes(normalized)
}
