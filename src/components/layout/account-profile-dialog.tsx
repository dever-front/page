import { useState } from 'react'
import { useActionSubmission } from '@/hooks/use-action-submission'
import { runActionWithResult } from '@/lib/action'
import { toastActionResult } from '@/lib/action-toast'
import { type PageStore } from '@/lib/store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Page } from '@/page/page'

type AccountProfileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PROFILE_PAGE_ROUTE = '/front/account/profile'

export function AccountProfileDialog({
  open,
  onOpenChange,
}: AccountProfileDialogProps) {
  const user = useAuthStore((state) => state.auth.user)
  const setUser = useAuthStore((state) => state.auth.setUser)
  const [pageStore, setPageStore] = useState<PageStore | null>(null)
  const { submitting, isSubmitting, run } = useActionSubmission(pageStore, 'submit')
  const handleOpenChange = (nextOpen: boolean) => {
    if (!isSubmitting()) onOpenChange(nextOpen)
  }

  const handleSubmit = async () => {
    if (!pageStore) return
    await run(async execution => {
      if (!pageStore.getState().validateForm()) return
      const result = await runActionWithResult(pageStore, 'submit', execution)
      toastActionResult(result, {
        defaultSuccessMessage: '个人信息已更新',
      })
      if (!result.success) {
        return
      }

      const nextName = String(
        pageStore.getState().getValueByPath('form.name') ?? ''
      ).trim()
      if (user && nextName) {
        setUser({ ...user, name: nextName })
      }

      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg'>
        <DialogHeader className='px-6 py-4 text-start'>
          <DialogTitle>个人信息</DialogTitle>
          <DialogDescription>在这里更新当前登录账户的姓名和密码，密码留空则保持不变。</DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1 overflow-y-auto px-6 py-2'>
          {open ? (
            <Page
              route={PROFILE_PAGE_ROUTE}
              onStoreReady={setPageStore}
              updateDocumentTitle={false}
            />
          ) : null}
        </div>

        <DialogFooter className='px-6 py-4'>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            type='button'
            onClick={() => void handleSubmit()}
            disabled={!pageStore || submitting}
          >
            {submitting ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
