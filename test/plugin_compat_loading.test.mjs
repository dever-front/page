import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileFunction } from 'node:vm'
import ts from 'typescript'

const pluginRoot = fileURLToPath(new URL('../src/lib/plugin/', import.meta.url))

// 执行真实 SDK 和加载映射，仅替换渲染模块，避免初始化浏览器或网络。
function harness() {
  const calls = []
  const failures = new Set()
  const cache = new Map()
  function load(filename) {
    const path = filename.endsWith('.ts') ? filename : `${filename}.ts`
    if (cache.has(path)) return cache.get(path)
    const module = {}
    cache.set(path, module)
    const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
      fileName: path,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    })
    const requireModule = (specifier) => {
      if (specifier === '@tanstack/react-router') return {}
      if (specifier === './types') {
        return { defineFrontPlugin() {}, lazyNode() {}, mergePluginNodes() {} }
      }
      if (specifier === './compat/runtime-ui') {
        const sources = load(resolve(pluginRoot, 'compat/sources'))
        return {
          compatModules: Object.fromEntries(
            Object.values({
              ...sources.runtimeCompatSources,
              ...sources.uiCompatSources,
            }).map((source) => [source, { source }])
          ),
        }
      }
      if (specifier.startsWith('.')) {
        return load(resolve(dirname(path), specifier))
      }
      calls.push(specifier)
      if (failures.delete(specifier)) throw new Error('simulated load failure')
      if (specifier === '@/components/resource/resource-preview-dialog') {
        return { source: specifier, ResourcePreviewDialog() {} }
      }
      return {
        source: specifier,
        richTextEditorModule: { source: specifier },
      }
    }
    compileFunction(outputText, ['exports', 'require'], { filename: path })(
      module,
      requireModule
    )
    return module
  }
  const sdk = load(resolve(pluginRoot, 'sdk-compat'))
  const sources = load(resolve(pluginRoot, 'compat/sources'))
  calls.length = 0
  return { ...sdk, sources, calls, failures, api: sdk.createFrontPluginSDK() }
}

test('画布协议和视频预览加载不带入助手弹窗或输入编辑器', async () => {
  const h = harness()
  const protocol = h.sources.assistantCompatSources.agentResultProtocol
  const video = h.sources.contentCompatSources.firstFrameVideo
  await h.ensureCompatModules([protocol, video])
  assert.deepEqual(h.calls.sort(), [protocol, video].sort())
  assert.equal(h.api.getCompatModule(protocol).source, protocol)
  assert.equal(h.api.getCompatModule(video).source, video)
  assert.deepEqual(
    h.api.getCompatModule(h.sources.contentCompatSources.referenceComposer),
    {}
  )
  assert.deepEqual(
    h.api.getCompatModule(h.sources.contentCompatSources.resourcePreviewDialog),
    {}
  )
})

test('资源详情按需加载现有组件，不加载其他兼容模块', async () => {
  const h = harness()
  const source = h.sources.contentCompatSources.resourcePreviewDialog
  assert.equal(source, '@/components/resource/resource-preview-dialog')
  assert.deepEqual(h.calls, [])
  assert.deepEqual(h.api.getCompatModule(source), {})

  await h.ensureCompatModules([source])

  assert.deepEqual(h.calls, [source])
  assert.equal(h.api.getCompatModule(source).source, source)
  assert.equal(
    typeof h.api.getCompatModule(source).ResourcePreviewDialog,
    'function'
  )
  for (const otherSource of [
    h.sources.contentCompatSources.referenceComposer,
    h.sources.assistantCompatSources.memoryDialog,
    h.sources.editorCompatSources.richTextEditor,
  ]) {
    assert.deepEqual(h.api.getCompatModule(otherSource), {})
  }
})

test('显式空依赖不加载模块，同一模块的并发请求只加载一次', async () => {
  const h = harness()
  const source = h.sources.contentCompatSources.contentView
  await h.ensureCompatModules([])
  assert.equal(h.calls.length, 0)
  await Promise.all([
    h.ensureCompatModules([source]),
    h.ensureCompatModules([` ${source} `, source]),
  ])
  assert.deepEqual(h.calls, [source])
  const loaded = h.api.getCompatModule(source)
  await h.ensureCompatModules([source])
  assert.equal(h.api.getCompatModule(source), loaded)
  assert.equal(h.calls.length, 1)
})

test('详情所需模块后加载，保留已经加载的预览模块', async () => {
  const h = harness()
  const video = h.sources.contentCompatSources.firstFrameVideo
  const memory = h.sources.assistantCompatSources.memoryDialog
  await h.ensureCompatModules([video])
  const loadedVideo = h.api.getCompatModule(video)
  await h.ensureCompatModules([memory])
  assert.deepEqual(h.calls, [video, memory])
  assert.equal(h.api.getCompatModule(memory).source, memory)
  assert.equal(h.api.getCompatModule(video), loadedVideo)
})

test('模块加载失败可以重试，不留下不可恢复的 promise', async () => {
  const h = harness()
  const source = h.sources.assistantCompatSources.agentResultProtocol
  h.failures.add(source)
  await assert.rejects(
    h.ensureCompatModules([source]),
    /simulated load failure/
  )
  assert.deepEqual(h.api.getCompatModule(source), {})
  await h.ensureCompatModules([source])
  assert.equal(h.api.getCompatModule(source).source, source)
  assert.deepEqual(h.calls, [source, source])
})

test('未声明依赖的插件仍得到全部公开模块，未知模块明确拒绝', async () => {
  const h = harness()
  await h.ensureCompatModules()
  for (const group of Object.values(h.sources)) {
    for (const source of Object.values(group)) {
      if (source === h.sources.directCompatSources.pageNodes) continue
      assert.ok(Object.keys(h.api.getCompatModule(source)).length > 0, source)
    }
  }
  await assert.rejects(
    h.ensureCompatModules(['@/unknown-module']),
    /宿主未注册兼容模块/
  )
})
