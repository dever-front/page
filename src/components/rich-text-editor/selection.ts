import type { Editor } from '@tiptap/core'
import {
  serializeRichTextEditorContent,
  type RichTextContentFormat,
} from './format'

export type RichTextSelection = {
  from: number
  to: number
  text: string
  content: string
}

/** 按捕获的位置替换，使用原生开放切片保留选区外的段落和列表结构。 */
export function replaceRichTextSelection(
  editor: Editor,
  format: RichTextContentFormat,
  selection: RichTextSelection,
  replacement: string
): boolean {
  if (
    editor.isDestroyed ||
    !editor.isEditable ||
    !editor.markdown ||
    serializeRichTextEditorContent(editor, format) !== selection.content ||
    selection.from < 0 ||
    selection.to > editor.state.doc.content.size ||
    selection.from >= selection.to ||
    editor.state.doc.textBetween(selection.from, selection.to, '\n') !==
      selection.text
  )
    return false

  const parsed = editor.schema.nodeFromJSON(editor.markdown.parse(replacement))
  // 文本型替换开放首尾段落，像原生粘贴一样接回未选中的前后文字。
  const slice =
    parsed.firstChild?.type.name === 'paragraph' &&
    parsed.lastChild?.type.name === 'paragraph'
      ? parsed.slice(1, parsed.content.size - 1, true)
      : parsed.slice(0, parsed.content.size)
  return editor
    .chain()
    .setTextSelection({ from: selection.from, to: selection.to })
    .command(({ tr }) => {
      tr.replaceSelection(slice)
      return true
    })
    .run()
}
