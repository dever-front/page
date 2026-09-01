import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeRouteQueryParams } from '../src/lib/route-context.ts'

test('远程数据刷新保留页面路由参数', () => {
  assert.deepEqual(
    mergeRouteQueryParams(
      '/bot/body/statistics/user_work_detail?id=42&user_id=7',
      { page: 2, pageSize: 20 }
    ),
    { id: '42', user_id: '7', page: 2, pageSize: 20 }
  )
})

test('当前刷新参数覆盖路由中的旧分页参数', () => {
  assert.deepEqual(
    mergeRouteQueryParams('/records?id=42&page=1&pageSize=10', {
      page: 3,
      pageSize: 50,
    }),
    { id: '42', page: 3, pageSize: 50 }
  )
})
