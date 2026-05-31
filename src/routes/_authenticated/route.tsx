import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAccessTokenKey, useAuthStore } from '@/stores/auth-store'
import { getCookie } from '@/lib/cookies'
import { lazyRouteComponent } from '@/lib/lazy-route'
import { FrontBootScreen } from '@/components/layout/front-boot-screen'

const AuthenticatedLayout = lazyRouteComponent(
  () =>
    import('@/components/layout/authenticated-layout').then((mod) => ({
      default: mod.AuthenticatedLayout,
    })),
  <FrontBootScreen />
)

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    const token =
      useAuthStore.getState().auth.accessToken || getCookie(getAccessTokenKey())

    if (!token) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedLayout,
})
