import { useState } from 'react'
import { LogOut, UserRound } from 'lucide-react'
import useDialogState from '@/hooks/use-dialog-state'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { AccountProfileDialog } from './account-profile-dialog'

export function TopUserNav() {
  const [open, setOpen] = useDialogState()
  const [profileOpen, setProfileOpen] = useState(false)
  const user = useAuthStore((state) => state.auth.user)
  const name = user?.name?.trim() || '系统账户'
  const account = user?.account?.trim() || '未登录'
  const fallback = getAvatarFallback(name)

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='relative size-10 rounded-full p-0 hover:bg-accent'
          >
            <Avatar className='size-9 rounded-full'>
              <AvatarImage src='' alt={name} />
              <AvatarFallback className='rounded-full text-sm font-semibold'>
                {fallback}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          forceMount
          className='w-64 rounded-xl p-0'
        >
          <DropdownMenuLabel className='px-4 py-3 font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-base leading-none font-semibold'>{name}</p>
              <p className='text-sm leading-none text-muted-foreground'>
                {account}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className='my-0' />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => setProfileOpen(true)}
              className='gap-3 rounded-none px-4 py-3 text-base'
            >
              <UserRound className='size-4.5 text-muted-foreground' />
              个人信息
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className='my-0' />
          <DropdownMenuItem
            variant='destructive'
            onClick={() => setOpen(true)}
            className='gap-3 rounded-none px-4 py-3 text-base'
          >
            <LogOut className='size-4.5' />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}

function getAvatarFallback(name: string) {
  const firstChar = Array.from(name.trim())[0]
  return firstChar ? firstChar.toUpperCase() : '系'
}
