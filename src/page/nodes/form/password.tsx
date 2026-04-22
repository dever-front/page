/**
 * Form/Password.tsx - 密码输入
 */
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

export function FormPassword({ item, value, setValue, error }: NodeItemProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative w-full min-w-0">
      <Input
        id={item.id}
        name={item.id}
        type={visible ? 'text' : 'password'}
        placeholder={item.placeholder}
        value={value ?? ''}
        onChange={(e) => setValue(e.target.value)}
        autoComplete={item.meta?.autoComplete ?? 'new-password'}
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        aria-invalid={!!error}
        className={cn(
          'w-full pr-10',
          error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
          item.meta?.controlClassName
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3"
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </Button>
    </div>
  )
}
