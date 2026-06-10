import { useMemo } from 'react'
import { AssistantMediaGenerateLazyButton } from '@/components/assistant/lazy-media-generate'
import {
  normalizeEditorUploadRules,
  RichTextEditor,
  resolveRichTextContentFormat,
} from '@/components/rich-text-editor'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import { mergeResourceUploadRules, normalizeResourceUploadRules } from '@/lib/resource'
import type { UploadFileItem } from '@/lib/upload'
import type { NodeItemProps } from '../../nodes'

export function FormEditor({
  item,
  value,
  setValue,
  error,
  store,
  assistantAdornment,
}: NodeItemProps) {
  const placeholder = String(item.placeholder || '请输入内容')
  const disabled = !!item.meta?.disabled
  const minHeight = Number(item.meta?.minHeight || 220)
  const maxHeight = Math.max(Number(item.meta?.maxHeight || 560), minHeight + 120)
  const contentFormat = resolveRichTextContentFormat(item.meta?.contentFormat)
  const rawUploadRules = useMemo(
    () => normalizeResourceUploadRules(item.meta?.uploadRules),
    [item.meta?.uploadRules]
  )
  const baseUploadRules = useMemo(
    () => normalizeEditorUploadRules(rawUploadRules),
    [rawUploadRules]
  )
  const uploadRuleMetas = useUploadRuleMetas(rawUploadRules.map((current) => current.ruleId))
  const uploadRules = useMemo(
    () => normalizeEditorUploadRules(mergeResourceUploadRules(baseUploadRules, uploadRuleMetas)),
    [baseUploadRules, uploadRuleMetas]
  )

  return (
    <RichTextEditor
      id={item.id}
      value={value}
      onChange={setValue}
      contentFormat={contentFormat}
      placeholder={placeholder}
      disabled={disabled}
      error={!!error}
      minHeight={minHeight}
      maxHeight={maxHeight}
      controlClassName={item.meta?.controlClassName}
      uploadRules={uploadRules}
      assistantAdornment={assistantAdornment}
      renderAiGenerate={({ kind, disabled: mediaDisabled, onGenerated }) => (
        <AssistantMediaGenerateLazyButton
          store={store}
          item={item}
          kind={kind}
          surface="editor"
          uploadRules={uploadRules}
          maxResults={4}
          variant="ghost"
          size="sm"
          hideTriggerIcon
          className="h-auto w-full justify-start rounded-sm px-2 py-1.5 text-sm font-normal text-foreground shadow-none hover:bg-accent hover:text-accent-foreground"
          disabled={mediaDisabled}
          onGenerated={(items: UploadFileItem[]) => onGenerated(items)}
        />
      )}
    />
  )
}
