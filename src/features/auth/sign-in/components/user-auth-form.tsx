import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { loadMainInfo, request, resetFrontRuntimeCache } from '@/lib/request'
import { resolvePostLoginTarget } from '@/lib/auth-redirect'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  account: z
    .string()
    .min(1, '请输入账户')
    .regex(/^1\d{10}$/, '账户必须是手机号格式'),
  password: z
    .string()
    .min(1, '请输入密码')
    .min(6, '密码至少 6 位'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      account: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const result = await request('/front/auth/login', 'post', data)
      if (result.code !== 0 || !result.data?.token) {
        toast.error(result.message || '登录失败')
        return
      }

      resetFrontRuntimeCache()
      auth.setUser(result.data.user)
      auth.setAccessToken(result.data.token)

      const mainInfo = await loadMainInfo()
      const target = resolvePostLoginTarget({
        redirectTo,
        entry: mainInfo.entry,
        menu: mainInfo.menu,
        auth: mainInfo.auth,
        authRules: mainInfo.authRules,
      })
      navigate({ to: target.to, search: target.search, replace: true })
      toast.success(`欢迎回来，${result.data.user?.name || data.account}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='account'
          render={({ field }) => (
            <FormItem>
              <FormLabel>账户</FormLabel>
              <FormControl>
                <Input placeholder='请输入手机号' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='请输入密码' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          登录
        </Button>
      </form>
    </Form>
  )
}
