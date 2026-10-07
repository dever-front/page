import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { compileFunction } from 'node:vm'
import ts from 'typescript'

const sourceURL = new URL(
  '../src/components/agent/stream-request-params.tsx',
  import.meta.url
)
const { outputText } = ts.transpileModule(readFileSync(sourceURL, 'utf8'), {
  fileName: sourceURL.pathname,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
})
const moduleExports = {}
compileFunction(outputText, ['exports', 'require'], {
  filename: sourceURL.pathname,
})(
  moduleExports,
  (specifier) =>
    new Proxy(
      {},
      {
        get(_target, name) {
          throw new Error(
            `排序测试不应调用外部依赖：${specifier}.${String(name)}`
          )
        },
      }
    )
)
const { normalizePowerParams } = moduleExports

for (const [source, serviceIDs] of [
  ['A', [30, 10, 20]],
  ['B', [70, 90, 80]],
]) {
  test(`来源 ${source} 的同序参数按能力 ID 排列，不受服务 ID 影响`, () => {
    const params = [
      { id: serviceIDs[0], power_param_id: '10', key: 'width', sort: 0 },
      { id: serviceIDs[1], power_param_id: '20', key: 'height', sort: 0 },
      { id: serviceIDs[2], power_param_id: '2', key: 'seed', sort: 0 },
    ]

    assert.deepEqual(
      normalizePowerParams(params).map((param) => param.key),
      ['seed', 'width', 'height']
    )
  })
}

test('能力排序优先，同一能力的多个服务输入槽按服务 ID 排列且完整保留', () => {
  const params = [
    { id: 1, power_param_id: 1, key: 'later', sort: 10 },
    { id: '90', power_param_id: 10, key: 'second_image', sort: 0 },
    { id: '80', power_param_id: 10, key: 'first_image', sort: 0 },
    { id: 10, power_param_id: 20, key: 'seed', sort: 0 },
  ]

  assert.deepEqual(
    normalizePowerParams(params).map((param) => [param.id, param.key]),
    [
      ['80', 'first_image'],
      ['90', 'second_image'],
      [10, 'seed'],
      [1, 'later'],
    ]
  )
})

test('能力参数 ID 缺省、空值或为零时使用原 ID 排序', () => {
  const params = [
    { id: '9', key: 'missing' },
    { id: 2, power_param_id: 0, key: 'zero' },
    { id: 99, power_param_id: 5, key: 'configured' },
    { id: 7, power_param_id: '', key: 'empty' },
  ]

  assert.deepEqual(
    normalizePowerParams(params).map((param) => param.key),
    ['zero', 'configured', 'empty', 'missing']
  )
})
