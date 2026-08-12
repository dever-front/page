import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptRoot = path.dirname(fileURLToPath(import.meta.url))
const frontRoot = path.resolve(scriptRoot, '..')
const publishRoot = path.resolve(frontRoot, '../backend/package/front/front')
const suffix = String(process.pid)
const publishPaths = {
  current: path.join(publishRoot, 'html'),
  next: path.join(publishRoot, `.html-next-${suffix}`),
  previous: path.join(publishRoot, `.html-prev-${suffix}`),
}

validatePublishPaths()
ensureTemporaryPathsAvailable()

try {
  runViteBuild()
  validateStagedHost()
  publishStagedHost()
} catch (error) {
  try {
    cleanupPath(publishPaths.next)
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      `宿主前端构建或发布失败，且 staging 清理失败：${publishPaths.next}`
    )
  }
  throw error
}

function runViteBuild() {
  const result = spawnSync('pnpm', ['exec', 'vite', 'build'], {
    cwd: frontRoot,
    env: {
      ...process.env,
      VITE_FRONT_BASE: '/admin/',
      VITE_FRONT_OUT_DIR: publishPaths.next,
    },
    stdio: 'inherit',
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`宿主前端构建失败，退出码 ${result.status ?? 'unknown'}`)
  }
}

function validateStagedHost() {
  const indexFile = path.join(publishPaths.next, 'index.html')
  if (!fs.statSync(indexFile, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`宿主前端 staging 缺少 index.html: ${indexFile}`)
  }
}

function publishStagedHost() {
  const hadCurrent = pathExists(publishPaths.current)
  if (hadCurrent) {
    fs.renameSync(publishPaths.current, publishPaths.previous)
  }
  try {
    fs.renameSync(publishPaths.next, publishPaths.current)
  } catch (error) {
    if (hadCurrent) {
      try {
        fs.renameSync(publishPaths.previous, publishPaths.current)
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `宿主前端切换失败且旧产物恢复失败；旧产物仍保留在 ${publishPaths.previous}`
        )
      }
    }
    throw error
  }

  if (hadCurrent) {
    try {
      cleanupPath(publishPaths.previous)
    } catch (error) {
      console.warn(
        `宿主新产物已发布，但旧目录清理失败，请人工处理 ${publishPaths.previous}:`,
        error
      )
    }
  }
}

function validatePublishPaths() {
  for (const candidate of Object.values(publishPaths)) {
    if (path.dirname(candidate) !== publishRoot) {
      throw new Error(`宿主前端发布目录越界: ${candidate}`)
    }
  }
  if (!/^\.html-next-\d+$/.test(path.basename(publishPaths.next))) {
    throw new Error(`宿主前端 staging 目录非法: ${publishPaths.next}`)
  }
  if (!/^\.html-prev-\d+$/.test(path.basename(publishPaths.previous))) {
    throw new Error(`宿主前端 previous 目录非法: ${publishPaths.previous}`)
  }
}

function ensureTemporaryPathsAvailable() {
  for (const candidate of [publishPaths.next, publishPaths.previous]) {
    if (pathExists(candidate)) {
      throw new Error(
        `宿主前端发布临时目录已存在，请人工确认后处理: ${candidate}`
      )
    }
  }
}

function cleanupPath(candidate) {
  if (
    path.dirname(candidate) !== publishRoot ||
    !/^\.html-(?:next|prev)-\d+$/.test(path.basename(candidate))
  ) {
    throw new Error(`拒绝清理非发布临时目录: ${candidate}`)
  }
  fs.rmSync(candidate, { force: true, recursive: true })
}

function pathExists(candidate) {
  return fs.lstatSync(candidate, { throwIfNoEntry: false }) !== undefined
}
