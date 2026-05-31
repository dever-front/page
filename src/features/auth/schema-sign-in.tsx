import { Suspense } from 'react'
import { useSearch } from '@tanstack/react-router'
import { getSiteConfig } from '@/config/app-config'
import { getRuntimePluginNodes } from '@/lib/plugin/runtime'
import { sourcePlugins } from '@/lib/plugin/source-plugins'
import { mergePluginNodes } from '@/lib/plugin/types'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { SiteLogo } from '@/components/layout/site-logo'
import { UserAuthForm } from './sign-in/components/user-auth-form'

type SchemaSignInProps = {
  schema: any
}

type LayoutNode = {
  type?: string
  className?: string
  children?: Record<string, LayoutNode>
}

type NodeItem = {
  type?: string
  name?: string
  info?: string
  className?: string
  meta?: Record<string, any>
}

const schemaPluginNodes = mergePluginNodes(sourcePlugins)

export function SchemaSignIn({ schema }: SchemaSignInProps) {
  const layout = schema?.layout
  if (!layout || typeof layout !== 'object') {
    return null
  }

  return <SchemaLayout layoutId='__root__' config={layout} schema={schema} />
}

function SchemaLayout({
  layoutId,
  config,
  schema,
}: {
  layoutId: string
  config: LayoutNode
  schema: any
}) {
  const children = (
    <>
      <SchemaNodes layoutId={layoutId} schema={schema} />
      {Object.entries(config.children ?? {}).map(([childId, childConfig]) => (
        <SchemaLayout
          key={childId}
          layoutId={childId}
          config={childConfig}
          schema={schema}
        />
      ))}
    </>
  )

  switch (config.type) {
    case 'card':
      return <Card className={config.className}>{children}</Card>
    case 'card-header':
      return <CardHeader className={config.className}>{children}</CardHeader>
    case 'card-content':
      return <CardContent className={config.className}>{children}</CardContent>
    case 'card-footer':
      return <CardFooter className={config.className}>{children}</CardFooter>
    case 'container':
    default:
      return config.className ? (
        <div className={config.className}>{children}</div>
      ) : (
        <>{children}</>
      )
  }
}

function SchemaNodes({ layoutId, schema }: { layoutId: string; schema: any }) {
  const items = Array.isArray(schema?.nodes?.[layoutId])
    ? schema.nodes[layoutId]
    : []

  return (
    <>
      {items.map((item: NodeItem, index: number) => (
        <SchemaNode key={itemKey(item, index)} item={item} />
      ))}
    </>
  )
}

function SchemaNode({ item }: { item: NodeItem }) {
  switch (item.type) {
    case 'app-site-brand':
      return <SchemaSiteBrand item={item} />
    case 'app-login-form':
      return <SchemaLoginForm item={item} />
    case 'show-title':
      return <SchemaTitle item={item} />
    default:
      return <SchemaPluginNode item={item} />
  }
}

function SchemaPluginNode({ item }: { item: NodeItem }) {
  const NodeComponent = item.type
    ? schemaPluginNodes[item.type] || getRuntimePluginNodes()[item.type]
    : undefined
  if (!NodeComponent) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <NodeComponent
        item={item as any}
        value={undefined}
        setValue={() => undefined}
        option={undefined}
        optionLoading={false}
        runAction={async () => undefined}
        store={undefined as any}
        layoutId='__auth__'
      />
    </Suspense>
  )
}

function SchemaSiteBrand({ item }: { item: NodeItem }) {
  const site = getSiteConfig()

  return (
    <div
      className={cn('flex min-w-0 items-center justify-center', item.className)}
    >
      <SiteLogo className={cn('me-2', item.meta?.logoClassName)} />
      <h1
        className={cn(
          'truncate text-xl font-medium',
          item.meta?.titleClassName
        )}
      >
        {item.name || site.name}
      </h1>
    </div>
  )
}

function SchemaLoginForm({ item }: { item: NodeItem }) {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <UserAuthForm
      redirectTo={redirect}
      accountLabel={item.meta?.accountLabel}
      accountPlaceholder={item.meta?.accountPlaceholder}
      passwordLabel={item.meta?.passwordLabel}
      passwordPlaceholder={item.meta?.passwordPlaceholder}
      submitText={item.meta?.submitText}
      loadingText={item.meta?.loadingText}
    />
  )
}

function SchemaTitle({ item }: { item: NodeItem }) {
  if (!item.name && !item.info) {
    return null
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', item.className)}>
      {item.name ? (
        <h1
          className={cn(
            'font-semibold tracking-tight text-foreground',
            item.meta?.variant === 'section' ? 'text-base' : 'text-xl',
            item.meta?.titleClassName
          )}
        >
          {item.name}
        </h1>
      ) : null}
      {item.info ? (
        <p
          className={cn(
            'text-sm leading-6 text-muted-foreground',
            item.meta?.descriptionClassName
          )}
        >
          {item.info}
        </p>
      ) : null}
    </div>
  )
}

function itemKey(item: NodeItem, index: number) {
  return `${item.type || 'node'}-${item.name || index}`
}
