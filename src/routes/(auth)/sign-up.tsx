import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const SignUp = lazyRouteComponent(() =>
  import('@/features/auth/sign-up').then((mod) => ({ default: mod.SignUp }))
)

export const Route = createFileRoute('/(auth)/sign-up')({
  component: SignUp,
})
