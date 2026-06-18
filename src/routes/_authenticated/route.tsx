import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAccessTokenKey, useAuthStore } from '@/stores/auth-store'
import { getRuntimeConfig } from '@/config/app-config'
import { getCookie } from '@/lib/cookies'
import { lazyRouteComponent } from '@/lib/lazy-route'
import { FrontBootFallback } from '@/components/layout/front-boot-screen'

const AuthenticatedLayout = lazyRouteComponent(
  () =>
    import('@/components/layout/authenticated-layout').then((mod) => ({
      default: mod.AuthenticatedLayout,
    })),
  <FrontBootFallback />
)

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (getRuntimeConfig().access?.mode === 'public') {
      return
    }

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
