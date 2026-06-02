import { useEffect, useState } from 'react'
import { REQUEST_ERROR_EVENT, type RequestErrorDetail } from '@/lib/request'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function RequestErrorDialog() {
  const [detail, setDetail] = useState<RequestErrorDetail | null>(null)

  useEffect(() => {
    const handleError = (event: Event) => {
      const customEvent = event as CustomEvent<RequestErrorDetail>
      if (!customEvent.detail?.message) {
        return
      }
      if (Number(customEvent.detail.code) === 401) {
        return
      }

      setDetail(customEvent.detail)
    }

    window.addEventListener(REQUEST_ERROR_EVENT, handleError)
    return () => {
      window.removeEventListener(REQUEST_ERROR_EVENT, handleError)
    }
  }, [])

  return (
    <AlertDialog
      open={!!detail}
      onOpenChange={(open) => !open && setDetail(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>操作失败</AlertDialogTitle>
          <AlertDialogDescription>
            {detail?.message || '请求处理失败。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>知道了</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
