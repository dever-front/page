import { Command } from 'lucide-react'
import { getSiteConfig } from '@/config/app-config'
import { type SidebarData } from '../types'

const site = getSiteConfig()

export const sidebarData: SidebarData = {
  user: {
    name: site.name,
    email: '',
    avatar: '',
  },
  teams: [
    {
      name: site.name,
      logo: Command,
      plan: site.subtitle,
    },
  ],
  navGroups: [],
}
