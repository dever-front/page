import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import type { LayoutComponentProps } from './types'

export function CardLayout({ config, children }: LayoutComponentProps) {
  return <Card className={config.className}>{children}</Card>
}

export function CardHeaderLayout({ config, children }: LayoutComponentProps) {
  return <CardHeader className={config.className}>{children}</CardHeader>
}

export function CardContentLayout({ config, children }: LayoutComponentProps) {
  return <CardContent className={config.className}>{children}</CardContent>
}

export function CardFooterLayout({ config, children }: LayoutComponentProps) {
  return <CardFooter className={config.className}>{children}</CardFooter>
}
