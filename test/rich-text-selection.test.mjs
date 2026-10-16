import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { compileFunction } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { Editor } = require('@tiptap/core')
const { default: StarterKit } = require('@tiptap/starter-kit')
const { Markdown } = require('@tiptap/markdown')
const sourceRoot = new URL('../src/', import.meta.url).pathname
const cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const exports = {}
  cache.set(filename, exports)
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  })
  compileFunction(outputText, ['exports', 'require'], { filename })(
    exports,
    (specifier) => {
      if (specifier.startsWith('.'))
        return load(path.resolve(path.dirname(filename), specifier + '.ts'))
      if (specifier.startsWith('@/'))
        return load(path.join(sourceRoot, specifier.slice(2) + '.ts'))
      return require(specifier)
    }
  )
  return exports
}
const { replaceRichTextSelection } = load(
  path.join(sourceRoot, 'components/rich-text-editor/selection.ts')
)
const { serializeRichTextEditorContent } = load(
  path.join(sourceRoot, 'components/rich-text-editor/format.ts')
)

function editorFor(content) {
  const editor = new Editor({
    element: null,
    extensions: [StarterKit, Markdown],
    content,
    contentType: 'markdown',
  })
  // 无 DOM 的定向测试仅运行真实文档事务；挂载与销毁守卫由浏览器交互验证。
  Object.defineProperty(editor, 'isDestroyed', {
    value: false,
    configurable: true,
  })
  return editor
}
function capture(editor, text, occurrence = 0, format = 'markdown') {
  let remaining = occurrence
  let range
  editor.state.doc.descendants((node, position) => {
    if (range || !node.isText) return
    let start = -1
    for (let index = 0; index <= remaining; index++) {
      start = node.text.indexOf(text, start + 1)
      if (start < 0) return
    }
    range = {
      from: position + start,
      to: position + start + text.length,
      text,
      content: serializeRichTextEditorContent(editor, format),
    }
    remaining = 0
  })
  assert.ok(range, 'Test selection exists in actual ProseMirror document')
  return range
}

test('列表句中替换保留同段标点、前后文字和其他剧情卡片', () => {
  const editor = editorFor(
    '1. **起因**\n\n   前文，新线索指向港口。后文。\n\n2. **后果**\n\n   下一步保持。'
  )
  const before = editor.getJSON()
  const selection = capture(editor, '新线索指向港口')
  assert.equal(
    replaceRichTextSelection(editor, 'markdown', selection, '新线索指向车站'),
    true
  )
  const after = editor.getJSON()
  const expected = structuredClone(before)
  expected.content[0].content[0].content[1].content[0].text =
    '前文，新线索指向车站。后文。'
  assert.deepEqual(
    JSON.parse(JSON.stringify(after)),
    JSON.parse(JSON.stringify(expected))
  )
})

test('相同文字只改捕获的第二处，Markdown 行内格式不拆段', () => {
  const editor = editorFor('重复；重复。')
  const selection = capture(editor, '重复', 1)
  assert.equal(
    replaceRichTextSelection(editor, 'markdown', selection, '**替换**'),
    true
  )
  assert.equal(editor.state.doc.childCount, 1)
  assert.equal(editor.state.doc.textContent, '重复；替换。')
  assert.equal(editor.getJSON().content[0].content[1].marks[0].type, 'bold')
})

test('JSON 源文档保持同样的精确选区替换合同', () => {
  const editor = editorFor('前文，原文。后文。\n\n下一段保持。')
  const nextParagraph = editor.getJSON().content[1]
  const selection = capture(editor, '原文', 0, 'json')
  assert.equal(
    replaceRichTextSelection(editor, 'json', selection, '新内容'),
    true
  )
  assert.equal(editor.state.doc.childCount, 2)
  assert.equal(editor.state.doc.child(0).textContent, '前文，新内容。后文。')
  assert.deepEqual(editor.getJSON().content[1], nextParagraph)
})

test('跨原文段落的选区只合并选中的边界，保留两端和后一段', () => {
  const editor = editorFor('前文，选中开始\n\n选中结束。后文。\n\n保持原样。')
  const from = capture(editor, '选中开始').from
  const to = capture(editor, '选中结束').to
  const selection = {
    from,
    to,
    text: editor.state.doc.textBetween(from, to, '\n'),
    content: editor.getMarkdown(),
  }
  assert.equal(
    replaceRichTextSelection(editor, 'markdown', selection, '替换'),
    true
  )
  assert.equal(editor.state.doc.childCount, 2)
  assert.equal(editor.state.doc.child(0).textContent, '前文，替换。后文。')
  assert.equal(editor.state.doc.child(1).textContent, '保持原样。')
})

test('多个替换段落保留两端原文与相邻列表项', () => {
  const editor = editorFor('1. 前文，原文。后文。\n2. 下一项。')
  assert.equal(
    replaceRichTextSelection(
      editor,
      'markdown',
      capture(editor, '原文'),
      '第一段\n\n第二段'
    ),
    true
  )
  const list = editor.getJSON().content[0]
  assert.equal(list.type, 'orderedList')
  assert.equal(list.content.length, 2)
  assert.equal(list.content[0].content.length, 2)
  assert.equal(
    editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n'),
    '前文，第一段\n第二段。后文。\n下一项。'
  )
})

test('空替换只删除捕获区间，原文已变化和无效区间拒绝写入', () => {
  const editor = editorFor('前文，原文。后文。')
  const selection = capture(editor, '原文')
  const before = editor.getJSON()
  for (const invalid of [
    { ...selection, content: '旧的原文' },
    { ...selection, text: '错误选区' },
    { ...selection, from: -1 },
    { ...selection, to: editor.state.doc.content.size + 1 },
    { ...selection, to: selection.from },
  ]) {
    assert.equal(
      replaceRichTextSelection(editor, 'markdown', invalid, '不能写入'),
      false
    )
    assert.deepEqual(editor.getJSON(), before)
  }
  assert.equal(
    replaceRichTextSelection(editor, 'markdown', selection, ''),
    true
  )
  assert.equal(editor.state.doc.childCount, 1)
  assert.equal(editor.state.doc.textContent, '前文，。后文。')
})
