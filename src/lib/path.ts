/**
 * path.ts - 路径解析与赋值
 * 统一解析 value 路径，区分 data/state 归属
 * 统一读写嵌套对象
 */

export type PathOwner = 'current' | 'parent'
export type PathScope = 'data' | 'state'

export function isScopedStorePath(path: string) {
  return (
    path.startsWith('parent.state.') ||
    path.startsWith('parent.data.') ||
    path.startsWith('state.') ||
    path.startsWith('data.')
  )
}

/**
 * 解析路径归属
 * - parent.state.xxx -> { owner: 'parent', scope: 'state', key: 'xxx' }
 * - parent.data.xxx  -> { owner: 'parent', scope: 'data', key: 'xxx' }
 * - state.xxx        -> { owner: 'current', scope: 'state', key: 'xxx' }
 * - data.xxx         -> { owner: 'current', scope: 'data', key: 'xxx' }
 * - 其他             -> { owner: 'current', scope: 'data', key: path }
 */
export function resolvePath(path: string): { owner: PathOwner; scope: PathScope; key: string } {
  if (path.startsWith('parent.state.')) {
    return { owner: 'parent', scope: 'state', key: path.slice(13) }
  }
  if (path.startsWith('parent.data.')) {
    return { owner: 'parent', scope: 'data', key: path.slice(12) }
  }
  if (path.startsWith('state.')) {
    return { owner: 'current', scope: 'state', key: path.slice(6) }
  }
  if (path.startsWith('data.')) {
    return { owner: 'current', scope: 'data', key: path.slice(5) }
  }
  return { owner: 'current', scope: 'data', key: path }
}

/**
 * 从对象中按点分路径读取值
 * getByPath({ a: { b: 1 } }, 'a.b') => 1
 */
export function getByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined
  const keys = path.split('.')
  let current = obj
  for (const key of keys) {
    if (current == null) return undefined
    current = current[key]
  }
  return current
}

/**
 * 在对象上按点分路径设置值（深拷贝）
 * setByPath({ a: { b: 1 } }, 'a.b', 2) => { a: { b: 2 } }
 */
export function setByPath(obj: any, path: string, value: any): any {
  if (!path) return obj
  const keys = path.split('.')
  const result = structuredClone(obj ?? {})
  let current = result
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[keys[keys.length - 1]] = value
  return result
}

/**
 * assignPath: 类似 Object.assign 但支持嵌套路径
 * 将 source 合并到 obj[path] 上
 */
export function assignPath(obj: any, path: string, source: any): any {
  const existing = getByPath(obj, path)
  if (existing && typeof existing === 'object' && source && typeof source === 'object') {
    return setByPath(obj, path, { ...existing, ...source })
  }
  return setByPath(obj, path, source)
}
