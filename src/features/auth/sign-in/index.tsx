import { useEffect, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { loadPageSchema } from '@/lib/request'
import { systemPageRoute } from '@/lib/system-page-route'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FrontBootScreen } from '@/components/layout/front-boot-screen'
import { AuthLayout } from '../auth-layout'
import { SchemaSignIn } from '../schema-sign-in'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const loginRoute = systemPageRoute('login')
  const [schema, setSchema] = useState<any | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true

    async function loadLoginSchema() {
      const nextSchema = await loadPageSchema(loginRoute)
      if (!active) {
        return
      }
      setSchema(nextSchema)
      setLoaded(true)
    }

    void loadLoginSchema()
    return () => {
      active = false
    }
  }, [loginRoute])

  if (!loaded) {
    return <FrontBootScreen />
  }

  if (schema) {
    return <SchemaSignIn schema={schema} />
  }

  return <DefaultSignIn />
}

function DefaultSignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>登录系统</CardTitle>
          <CardDescription>
            请输入账户和密码后登录后台，
            <br />
            如果系统中还没有账户，首次输入的账户和密码会自动创建默认管理员
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
