import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInThisContext } from 'node:vm'

const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))

// 执行真实源码，仅替换网络、浏览器路由和 React 订阅；不初始化应用或发出请求。
function harness() {
  const calls: unknown[][] = []
  const toasts: string[] = []
  let respond = async (..._args: unknown[]) => ({
    code: 0,
    data: {},
    message: 'ok',
  })
  const mocks = {
    './request': {
      request: (...args: unknown[]) => {
        calls.push(args)
        return respond(...args)
      },
      joinFrontApi: (route: string) => route,
      clearRemotePageSchemaCache() {},
    },
    './remote-option-cache': { clearRemoteOptionCache() {} },
    './export-task': {},
    './navigation': { resolveNavigationRouteState: () => ({ query: {} }) },
    react: {
      ...require('react'),
      useCallback: (callback: any) => callback,
      useMemo: (callback: any) => callback(),
      useSyncExternalStore: (_subscribe: any, snapshot: any) => snapshot(),
    },
    sonner: {
      toast: {
        success: (message: string) => toasts.push(message),
        error: (message: string) => toasts.push(message),
      },
    },
  }
  const cache = new Map<string, { exports: any }>()
  function load(filename: string): any {
    const path = existsSync(filename) ? filename : `${filename}.ts`
    if (cache.has(path)) return cache.get(path)!.exports
    const module = { exports: {} }
    cache.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText
    runInThisContext(`(function(require,module,exports){${compiled}\n})`, {
      filename: path,
    })(
      (specifier: string) =>
        Object.hasOwn(mocks, specifier)
          ? mocks[specifier as keyof typeof mocks]
          : specifier.startsWith('.')
            ? load(resolve(dirname(path), specifier))
            : specifier.startsWith('@/')
              ? load(resolve(sourceRoot, specifier.slice(2)))
              : require(specifier),
      module,
      module.exports
    )
    return module.exports
  }
  const actions = load(resolve(sourceRoot, 'lib/action.ts'))
  const submissions = load(resolve(sourceRoot, 'lib/action-submission.ts'))
  const { createPageStore } = load(resolve(sourceRoot, 'lib/store.ts'))
  const { useActionSubmission } = load(
    resolve(sourceRoot, 'hooks/use-action-submission.ts')
  )
  const { toastActionResult } = load(resolve(sourceRoot, 'lib/action-toast.ts'))
  const makeStore = (
    action: any = {},
    data: any = { form: { name: 'example' } }
  ) =>
    createPageStore(
      {
        page: { route: '/records' },
        nodes: {},
        action,
        data,
        state: {},
      },
      '/records'
    )
  return {
    ...actions,
    ...submissions,
    useActionSubmission,
    toastActionResult,
    makeStore,
    calls,
    toasts,
    setRespond: (callback: typeof respond) => {
      respond = callback
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const ok = { code: 0, data: {}, message: 'ok' }

test('连续触发同一表单只发出一次保存请求，重复结果没有成功回调或提示', async () => {
  const h = harness()
  const gate = deferred<typeof ok>()
  h.setRespond(() => gate.promise)
  const store = h.makeStore({ submit: { type: 'save' } })
  const first = h.runActionsWithResult(store, 'submit')
  const duplicates = await Promise.all(
    Array.from({ length: 10 }, () => h.runActionsWithResult(store, 'submit'))
  )
  assert.equal(h.calls.length, 1)
  for (const result of duplicates) {
    assert.deepEqual(result, { success: false, ignored: true })
    h.toastActionResult(result)
  }
  assert.deepEqual(h.toasts, [])
  gate.resolve(ok)
  assert.equal((await first).success, true)
  assert.equal(store.getState().pendingSubmissions.size, 0)
})

test('动作数组及 then 完整执行一次，后续刷新期间仍拒绝重复提交', async () => {
  const h = harness()
  const startedRefresh = deferred<void>()
  const refresh = deferred<typeof ok>()
  h.setRespond(async (api) => {
    if (api === '/refresh') {
      startedRefresh.resolve()
      return refresh.promise
    }
    return ok
  })
  const store = h.makeStore({
    submit: { type: 'save', then: ['refresh', 'count'] },
    refresh: { type: 'request', api: '/refresh' },
    count: { type: 'increment', key: 'state.completed' },
    close: { type: 'state', key: 'open', value: false },
  })
  store.getState().setPageState('open', true)
  const first = h.runActionsWithResult(store, ['submit', 'close'])
  await startedRefresh.promise
  assert.equal((await h.runActionWithResult(store, 'submit')).ignored, true)
  assert.equal(h.calls.length, 2)
  assert.equal(store.getState().state.open, true)
  refresh.resolve(ok)
  assert.equal((await first).success, true)
  assert.equal(store.getState().state.completed, 1)
  assert.equal(store.getState().state.open, false)
})

test('请求抛出异常后释放锁，可以重试', async () => {
  const h = harness()
  const store = h.makeStore({ submit: { type: 'save' } })
  h.setRespond(async () => {
    throw new Error('network unavailable')
  })
  await assert.rejects(
    h.runActionWithResult(store, 'submit'),
    /network unavailable/
  )
  assert.equal(store.getState().pendingSubmissions.size, 0)
  h.setRespond(async () => ok)
  assert.equal((await h.runActionWithResult(store, 'submit')).success, true)
  assert.equal(h.calls.length, 2)
})

test('业务校验失败保留字段错误，释放后允许重新提交', async () => {
  const h = harness()
  const store = h.makeStore({ submit: { type: 'save' } })
  store.getState().schema.nodes = {
    body: [{ id: 'name-input', type: 'form-input', value: 'form.name' }],
  }
  h.setRespond(async () => ({
    code: 1,
    data: { fieldErrors: { 'form.name': '名称重复' } },
    message: '',
  }))
  const failed = await h.runActionWithResult(store, 'submit')
  assert.equal(failed.success, false)
  assert.equal(store.getState().errors['name-input'], '名称重复')
  assert.equal(store.getState().pendingSubmissions.size, 0)
  h.setRespond(async () => ok)
  assert.equal((await h.runActionWithResult(store, 'submit')).success, true)
})

test('同一表单不同动作入口和 form/data.form 路径共享提交锁', async () => {
  const h = harness()
  const gate = deferred<typeof ok>()
  h.setRespond(() => gate.promise)
  const store = h.makeStore({ submit: { type: 'save', params: 'form' } })
  const first = h.runActionWithResult(store, 'submit')
  const second = await h.runActionConfigWithResult(store, {
    type: 'request',
    api: '/save',
    method: 'POST',
    params: 'data.form',
  })
  assert.equal(second.ignored, true)
  assert.equal(h.calls.length, 1)
  gate.resolve(ok)
  await first
})

test('自定义主键区分表格记录，相同行相同操作才互斥', async () => {
  const h = harness()
  const gate = deferred<typeof ok>()
  h.setRespond(() => gate.promise)
  const store = h.makeStore({ remove: { type: 'delete', params: '$row' } })
  const rowA = { row: { uuid: 'a' }, rowKey: 'uuid', rowIndex: 0 }
  const rowB = { row: { uuid: 'b' }, rowKey: 'uuid', rowIndex: 1 }
  const first = h.runActionsWithResult(store, 'remove', rowA)
  const other = h.runActionsWithResult(store, 'remove', rowB)
  assert.equal(
    (await h.runActionsWithResult(store, 'remove', rowA)).ignored,
    true
  )
  assert.equal(h.calls.length, 2)
  gate.resolve(ok)
  await Promise.all([first, other])
  assert.equal(store.getState().pendingSubmissions.size, 0)
})

test('不同页面表单可以同时提交', async () => {
  const h = harness()
  const gate = deferred<typeof ok>()
  h.setRespond(() => gate.promise)
  const first = h.runActionWithResult(
    h.makeStore({ submit: { type: 'save' } }),
    'submit'
  )
  const other = h.runActionWithResult(
    h.makeStore({ submit: { type: 'save' } }),
    'submit'
  )
  assert.equal(h.calls.length, 2)
  gate.resolve(ok)
  await Promise.all([first, other])
})

test('弹窗父动作与内嵌表单动作共享实际表单锁', async () => {
  const h = harness()
  const gate = deferred<typeof ok>()
  h.setRespond(() => gate.promise)
  const parent = h.makeStore({ submit: { type: 'save', params: '$modalForm' } })
  const child = h.makeStore({ submit: { type: 'save' } })
  const first = h.runActionWithResult(parent, 'submit', {
    modalStore: child,
    modalForm: child.getState().data.form,
  })
  assert.equal((await h.runActionWithResult(child, 'submit')).ignored, true)
  assert.equal(h.calls.length, 1)
  gate.resolve(ok)
  await first
})

test('hook 在同一轮渲染内同步抢锁，并覆盖校验和成功回调', async () => {
  const h = harness()
  const gate = deferred<typeof ok>()
  const successGate = deferred<void>()
  const startedSuccess = deferred<void>()
  h.setRespond(() => gate.promise)
  const store = h.makeStore({ submit: { type: 'save' } })
  const { run } = h.useActionSubmission(store, 'submit')
  let validations = 0
  let successes = 0
  const execute = () =>
    run(async (context: any) => {
      validations++
      const result = await h.runActionsWithResult(store, 'submit', context)
      if (result.success) {
        successes++
        startedSuccess.resolve()
        await successGate.promise
      }
    })
  const first = execute()
  await execute()
  assert.equal(validations, 1)
  assert.equal(h.useActionSubmission(store, 'submit').submitting, true)
  gate.resolve(ok)
  await startedSuccess.promise
  await execute()
  assert.equal(successes, 1)
  assert.equal(validations, 1)
  successGate.resolve()
  await first
  assert.equal(h.useActionSubmission(store, 'submit').submitting, false)
})

test('校验不通过和回调异常都能恢复按钮状态', async () => {
  const h = harness()
  const store = h.makeStore({ submit: { type: 'save' } })
  const { run } = h.useActionSubmission(store, 'submit')
  await run(async () => false)
  assert.equal(store.getState().pendingSubmissions.size, 0)
  await assert.rejects(
    run(async () => {
      throw new Error('callback failed')
    }),
    /callback failed/
  )
  assert.equal(store.getState().pendingSubmissions.size, 0)
})

test('嵌套动作释放自己的锁，不能提前释放外层；抢多个锁失败不留下半个锁', () => {
  const h = harness()
  const store = h.makeStore()
  const first = h.acquireActionSubmission([{ store, key: 'form' }])
  const nested = h.acquireActionSubmission(
    [
      { store, key: 'form' },
      { store, key: 'other' },
    ],
    first.context
  )
  nested.release()
  assert.equal(store.getState().pendingSubmissions.has('form'), true)
  assert.equal(
    h.acquireActionSubmission([
      { store, key: 'third' },
      { store, key: 'form' },
    ]),
    null
  )
  assert.equal(store.getState().pendingSubmissions.has('third'), false)
  first.release()
  assert.equal(store.getState().pendingSubmissions.size, 0)
})

test('schema 重置保留在途提交锁；读取和本地动作不受写锁影响', async () => {
  const h = harness()
  const gate = deferred<typeof ok>()
  h.setRespond(async (api) => (api === '/read' ? ok : gate.promise))
  const store = h.makeStore({ submit: { type: 'save' } })
  const first = h.runActionWithResult(store, 'submit')
  store.getState().reset(store.getState().schema)
  assert.equal((await h.runActionWithResult(store, 'submit')).ignored, true)
  assert.equal(
    (
      await h.runActionConfigWithResult(store, {
        type: 'request',
        api: '/read',
      })
    ).success,
    true
  )
  assert.equal(
    (
      await h.runActionConfigWithResult(store, {
        type: 'state',
        key: 'open',
        value: true,
      })
    ).success,
    true
  )
  gate.resolve(ok)
  await first
  assert.equal(store.getState().pendingSubmissions.size, 0)
})

test('父子页面提交同一实际父表单共享锁，混合动作链预先占用全部所属页面', async () => {
  const h = harness()
  const gate = deferred<typeof ok>()
  h.setRespond(() => gate.promise)
  const parent = h.makeStore({ submit: { type: 'save' } })
  const child = h.makeStore({
    own: { type: 'save' },
    parent: { type: 'save', params: 'parent.data.form' },
  })
  child.setState({ parentStore: parent })
  const first = h.runActionsWithResult(child, ['own', 'parent'])
  assert.equal((await h.runActionWithResult(parent, 'submit')).ignored, true)
  assert.equal((await h.runActionWithResult(child, 'parent')).ignored, true)
  assert.equal(h.calls.length, 1)
  gate.resolve(ok)
  assert.equal((await first).success, true)
  assert.equal(h.calls.length, 2)
  assert.equal(child.getState().pendingSubmissions.size, 0)
  assert.equal(parent.getState().pendingSubmissions.size, 0)
})

test('带弹窗上下文的父动作读取父 form，资源锁仍保护父表单', async () => {
  const h = harness()
  const gate = deferred<typeof ok>()
  h.setRespond(() => gate.promise)
  const parent = h.makeStore({ submit: { type: 'save' } })
  const child = h.makeStore({ submit: { type: 'save' } })
  const first = h.runActionWithResult(parent, 'submit', { modalStore: child })
  assert.equal((await h.runActionWithResult(parent, 'submit')).ignored, true)
  assert.equal((await h.runActionWithResult(child, 'submit')).ignored, true)
  gate.resolve(ok)
  await first
})

test('表单尚未加载时不执行提交；无 action 的直接提交也同步防重', async () => {
  const h = harness()
  let invoked = 0
  await h.useActionSubmission(null, 'submit').run(async () => {
    invoked++
  })
  assert.equal(invoked, 0)
  const gate = deferred<void>()
  const store = h.makeStore()
  const { run, isSubmitting } = h.useActionSubmission(
    store,
    undefined,
    {},
    'import-task'
  )
  const first = run(async () => {
    invoked++
    await gate.promise
  })
  assert.equal(isSubmitting(), true)
  await run(async () => {
    invoked++
  })
  assert.equal(invoked, 1)
  gate.resolve()
  await first
  assert.equal(isSubmitting(), false)
})

test('显式 modalData/modalState 参数与同一实际子页面路径共享资源锁', async () => {
  for (const [source, path] of [
    ['$modalData.draft', 'data.draft'],
    ['$modalState.draft', 'state.draft'],
  ]) {
    const h = harness()
    const gate = deferred<typeof ok>()
    h.setRespond(() => gate.promise)
    const parent = h.makeStore({ submit: { type: 'save', params: source } })
    const child = h.makeStore({ submit: { type: 'save', params: path } })
    child.getState().setPageState('draft', { name: 'example' })
    child.getState().setData('draft', { name: 'example' })
    const first = h.runActionWithResult(parent, 'submit', {
      modalStore: child,
      modalData: child.getState().data,
      modalState: child.getState().state,
    })
    assert.equal((await h.runActionWithResult(child, 'submit')).ignored, true)
    gate.resolve(ok)
    await first
  }
})
