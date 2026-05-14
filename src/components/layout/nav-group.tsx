import { type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { emitPageReload } from '@/lib/page-reload'
import { normalizeRouteKey } from '@/lib/route-key'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  type NavCollapsible,
  type NavItem,
  type NavLink,
  type NavGroup as NavGroupProps,
} from './types'

export function NavGroup({ title, items }: NavGroupProps) {
  const { state, isMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })
  return (
    <SidebarGroup>
      {title ? <SidebarGroupLabel>{title}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {items.map((item) => {
          const key = getNavItemKey(item)

          if (!isNavCollapsible(item))
            return <SidebarMenuLink key={key} item={item} href={href} />

          if (state === 'collapsed' && !isMobile)
            return (
              <SidebarMenuCollapsedDropdown key={key} item={item} href={href} />
            )

          return <SidebarMenuCollapsible key={key} item={item} href={href} />
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className='rounded-full px-1 py-0 text-xs'>{children}</Badge>
}

function SidebarMenuLink({ item, href }: { item: NavLink; href: string }) {
  const { setOpenMobile } = useSidebar()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    setOpenMobile(false)
    reloadCurrentMenuRoute(event, href, String(item.url))
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={checkIsActive(href, item)}
        tooltip={item.title}
      >
        <Link to={item.url} onClick={handleClick}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarMenuCollapsible({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  const { setOpenMobile } = useSidebar()
  const handleLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    url: string
  ) => {
    setOpenMobile(false)
    reloadCurrentMenuRoute(event, href, url)
  }

  return (
    <Collapsible
      asChild
      defaultOpen={checkIsActive(href, item)}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub className='me-0 pe-0'>
            {item.items.map((subItem) => (
              <SidebarMenuSubTreeItem
                key={getNavItemKey(subItem)}
                item={subItem}
                href={href}
                onLinkClick={handleLinkClick}
                depth={0}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function SidebarMenuSubTreeItem({
  item,
  href,
  onLinkClick,
  depth,
}: {
  item: NavItem
  href: string
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>, url: string) => void
  depth: number
}) {
  if (!isNavCollapsible(item)) {
    return (
      <SidebarMenuSubItem className='w-full'>
        <SidebarMenuSubButton
          asChild
          isActive={checkIsActive(href, item)}
          className={resolveSubTreeButtonClass(depth)}
        >
          <Link
            to={item.url}
            onClick={(event) => onLinkClick(event, String(item.url))}
          >
            {item.icon && <item.icon />}
            <span className='truncate'>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  return (
    <Collapsible
      asChild
      defaultOpen={checkIsActive(href, item)}
      className='group/sub-collapsible'
    >
      <SidebarMenuSubItem className='w-full'>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton
            asChild
            isActive={false}
            className={resolveSubTreeButtonClass(depth)}
          >
            <button type='button'>
              {item.icon && <item.icon />}
              <span className='truncate'>{item.title}</span>
              {item.badge && <NavBadge>{item.badge}</NavBadge>}
              <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-90 rtl:rotate-180' />
            </button>
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub className='mx-0 ms-0 mt-1 w-full border-0 px-0 py-0'>
            {item.items.map((child) => (
              <SidebarMenuSubTreeItem
                key={getNavItemKey(child)}
                item={child}
                href={href}
                onLinkClick={onLinkClick}
                depth={depth + 1}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  )
}

function SidebarMenuCollapsedDropdown({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  const buildClickHandler =
    (url: string) => (event: MouseEvent<HTMLAnchorElement>) =>
      reloadCurrentMenuRoute(event, href, url)
  const links = getLeafNavLinks(item.items)

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={checkIsActive(href, item)}
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
          <DropdownMenuLabel>
            {item.title} {item.badge ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {links.map((sub) => (
            <DropdownMenuItem key={`${sub.title}-${sub.url}`} asChild>
              <Link
                to={sub.url}
                onClick={buildClickHandler(String(sub.url))}
                className={`${checkIsActive(href, sub) ? 'bg-secondary' : ''}`}
              >
                {sub.icon && <sub.icon />}
                <span className='max-w-52 text-wrap'>{sub.title}</span>
                {sub.badge && (
                  <span className='ms-auto text-xs'>{sub.badge}</span>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function checkIsActive(href: string, item: NavItem) {
  const currentPath = href.split('?')[0]
  const itemActivePaths =
    'activePaths' in item && Array.isArray(item.activePaths)
      ? item.activePaths
      : []
  if (isNavCollapsible(item)) {
    return (
      itemActivePaths.includes(currentPath) ||
      item.items.some((child) => checkIsActive(href, child))
    )
  }

  return (
    href === item.url || // /endpint?search=param
    currentPath === item.url || // endpoint
    itemActivePaths.includes(currentPath)
  )
}

function isNavCollapsible(item: NavItem): item is NavCollapsible {
  return 'items' in item && Array.isArray(item.items) && item.items.length > 0
}

function getNavItemKey(item: NavItem) {
  if (isNavCollapsible(item)) {
    return `${item.title}-${resolveFirstNavItemUrl(item) || 'group'}`
  }
  return `${item.title}-${item.url}`
}

function resolveFirstNavItemUrl(item: NavItem): string {
  if (!isNavCollapsible(item)) {
    return String(item.url || '')
  }

  for (const child of item.items) {
    const matched = resolveFirstNavItemUrl(child)
    if (matched && matched !== '#') {
      return matched
    }
  }
  return ''
}

function getLeafNavLinks(items: NavItem[]) {
  const links: NavLink[] = []
  for (const item of items) {
    if (isNavCollapsible(item)) {
      links.push(...getLeafNavLinks(item.items))
      continue
    }
    links.push(item)
  }
  return links
}

function resolveSubTreeButtonClass(depth: number) {
  const classes = ['ps-3', 'ps-6', 'ps-9', 'ps-12']
  return `w-full text-start ${classes[Math.min(Math.max(depth, 0), classes.length - 1)]}`
}

function isSameMenuRoute(currentHref: string, nextHref: string) {
  return normalizeRouteKey(currentHref) === normalizeRouteKey(nextHref)
}

function reloadCurrentMenuRoute(
  event: MouseEvent<HTMLAnchorElement>,
  currentHref: string,
  nextHref: string
) {
  if (!isSameMenuRoute(currentHref, nextHref)) {
    return
  }

  event.preventDefault()
  emitPageReload(nextHref)
}
