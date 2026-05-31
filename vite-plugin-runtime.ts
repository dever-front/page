import type { PluginOption } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

type FrontRuntimePluginOptions = {
  projectRoot: string
}

type FrontConfig = {
  sites?: Record<string, FrontSite>
  auth?: unknown[]
}

type FrontSite = {
  name?: string
  subtitle?: string
  description?: string
  url?: string
  api?: string
  assets?: FrontSiteAssets
  setting?: FrontSiteSetting
  access?: {
    mode?: string
    authProvider?: string
  }
  public?: string[]
}

type FrontSiteAssets = {
  logo?: string
  favicon?: string
}

type FrontSiteSetting = {
  appearance?: Record<string, string>
  runtime?: {
    skin?: string
    routerMode?: string
    plugins?: string[]
  }
}

const DEFAULT_SITE_KEY = 'admin'
const DEFAULT_API = 'front'
const RUNTIME_HTML_PLACEHOLDER = '<!-- dever:runtime -->'

export function deverRuntimePlugin({
  projectRoot,
}: FrontRuntimePluginOptions): PluginOption {
  return {
    name: 'dever-front-runtime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void (async () => {
          const pathname = requestPathname(req.url || '')
          const siteAsset = runtimeSiteAsset(projectRoot, pathname)
          if (siteAsset) {
            sendRuntimeAsset(res, siteAsset)
            return
          }

          const defaultSiteKey = defaultRuntimeSiteKey(projectRoot)
          if (pathname === '/') {
            res.statusCode = 302
            res.setHeader('Location', `/${defaultSiteKey}/`)
            res.end()
            return
          }
          if (pathname === `/${defaultSiteKey}`) {
            res.statusCode = 302
            res.setHeader('Location', `/${defaultSiteKey}/`)
            res.end()
            return
          }
          const siteKeyWithoutSlash = pathname.match(/^\/([^/]+)$/)?.[1] || ''
          if (
            siteKeyWithoutSlash &&
            isRuntimeSiteKey(projectRoot, siteKeyWithoutSlash)
          ) {
            res.statusCode = 302
            res.setHeader('Location', `/${siteKeyWithoutSlash}/`)
            res.end()
            return
          }

          const runtimeKey = runtimeSiteKey(
            projectRoot,
            req.url || '',
            req.headers.referer
          )
          if (runtimeKey) {
            const site = loadRuntimeSite(projectRoot, runtimeKey)
            if (!site) {
              res.statusCode = 404
              res.end('runtime site not found')
              return
            }

            res.statusCode = 200
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader(
              'Content-Type',
              'application/javascript; charset=utf-8'
            )
            res.end(
              runtimeScript(runtimePayload(runtimeKey, site, req.headers.host))
            )
            return
          }

          const htmlSiteKey = htmlRuntimeSiteKey(projectRoot, pathname)
          if (!htmlSiteKey) {
            next()
            return
          }

          const site = loadRuntimeSite(projectRoot, htmlSiteKey)
          if (!site) {
            res.statusCode = 404
            res.end('runtime site not found')
            return
          }

          const indexFile = path.join(projectRoot, 'front', 'index.html')
          const rawHtml = fs.readFileSync(indexFile, 'utf8')
          const html = await server.transformIndexHtml(
            req.url || '/',
            injectRuntimeIntoHtml(
              rawHtml,
              runtimePayload(htmlSiteKey, site, req.headers.host)
            )
          )
          res.statusCode = 200
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        })().catch(next)
      })
    },
  }
}

function htmlRuntimeSiteKey(projectRoot: string, pathname: string) {
  if (path.posix.extname(pathname)) {
    return ''
  }

  const siteKey = pathname.split('/').find(Boolean) || ''
  return siteKey && isRuntimeSiteKey(projectRoot, siteKey) ? siteKey : ''
}

function runtimePayload(
  siteKey: string,
  site: FrontSite,
  hostHeader: string | undefined
) {
  const hostname = requestHostname(hostHeader)
  return {
    siteKey,
    basePath: `/${siteKey}`,
    apiHost: `http://${hostname}:8085/${trimSlashes(site.api || DEFAULT_API)}/`,
    site: {
      name: site.name || siteKey,
      subtitle: site.subtitle,
      description: site.description,
      url: site.url,
      logo:
        runtimeSiteAssetUrl(siteKey, site.assets?.logo) ||
        `/${siteKey}/assets/images/logo.svg`,
      favicon:
        runtimeSiteAssetUrl(siteKey, site.assets?.favicon) ||
        `/${siteKey}/assets/images/favicon.svg`,
    },
    appearance: site.setting?.appearance || {},
    runtime: site.setting?.runtime || {},
    access: {
      mode: site.access?.mode || 'rbac',
      authProvider: site.access?.authProvider || DEFAULT_API,
    },
  }
}

function runtimeScript(payload: unknown) {
  return `window.appRuntime = ${JSON.stringify(payload)};\n`
}

function injectRuntimeIntoHtml(html: string, payload: unknown) {
  const script = `<script>\n${runtimeScript(payload)}</script>`
  if (html.includes(RUNTIME_HTML_PLACEHOLDER)) {
    return html.replace(RUNTIME_HTML_PLACEHOLDER, script)
  }
  return html.replace('</head>', `${script}\n  </head>`)
}

function runtimeSiteAsset(projectRoot: string, pathname: string) {
  const match = pathname.match(/^\/([^/]+)\/assets\/([^/][^?]*)$/)
  const siteKey = match?.[1] || ''
  const assetPath = match?.[2] || ''
  if (!siteKey || !assetPath || !isRuntimeSiteKey(projectRoot, siteKey)) {
    return ''
  }

  return (
    existingSafePath(frontAssetRoot(projectRoot, siteKey), assetPath) ||
    existingSafePath(
      frontAssetRoot(projectRoot, DEFAULT_SITE_KEY),
      fallbackAssetPath(assetPath)
    )
  )
}

function frontAssetRoot(projectRoot: string, siteKey: string) {
  return path.join(projectRoot, 'backend', 'config', 'front', 'assets', siteKey)
}

function existingSafePath(rootPath: string, relativeAssetPath: string) {
  const filePath = path.join(rootPath, relativeAssetPath)
  const relativePath = path.relative(rootPath, filePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return ''
  }
  return fs.existsSync(filePath) ? filePath : ''
}

function sendRuntimeAsset(res: any, filePath: string) {
  res.statusCode = 200
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', runtimeAssetContentType(filePath))
  res.end(fs.readFileSync(filePath))
}

function runtimeAssetContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.svg':
      return 'image/svg+xml; charset=utf-8'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

function runtimeSiteKey(
  projectRoot: string,
  rawUrl: string,
  referer?: string | string[]
) {
  const pathname = requestPathname(rawUrl)
  const match = pathname.match(/^\/([^/]+)\/runtime\.js$/)
  if (match?.[1]) {
    return match[1]
  }

  if (pathname !== '/runtime.js') {
    return ''
  }

  const refererSiteKey = runtimeSiteKeyFromReferer(projectRoot, referer)
  return refererSiteKey || defaultRuntimeSiteKey(projectRoot)
}

function runtimeSiteKeyFromReferer(
  projectRoot: string,
  referer?: string | string[]
) {
  const value = Array.isArray(referer) ? referer[0] : referer
  if (!value) {
    return ''
  }

  const siteKey = requestPathname(value).split('/').find(Boolean) || ''
  if (!siteKey || !isRuntimeSiteKey(projectRoot, siteKey)) {
    return ''
  }
  return siteKey
}

function requestPathname(rawUrl: string) {
  return new URL(rawUrl, 'http://dever.local').pathname
}

function defaultRuntimeSiteKey(projectRoot: string) {
  const sites = readFrontConfig(projectRoot).sites || {}
  if (sites[DEFAULT_SITE_KEY]) {
    return DEFAULT_SITE_KEY
  }

  return Object.keys(sites).sort()[0] || DEFAULT_SITE_KEY
}

function isRuntimeSiteKey(projectRoot: string, siteKey: string) {
  const sites = readFrontConfig(projectRoot).sites || {}
  if (Object.keys(sites).length === 0) {
    return siteKey === DEFAULT_SITE_KEY
  }
  return Boolean(sites[siteKey])
}

function loadRuntimeSite(
  projectRoot: string,
  siteKey: string
): FrontSite | null {
  const config = readFrontConfig(projectRoot)
  const sites =
    config.sites && Object.keys(config.sites).length > 0
      ? config.sites
      : {
          [DEFAULT_SITE_KEY]: {
            name: '管理后台',
            api: DEFAULT_API,
            access: {
              mode: 'rbac',
              authProvider: DEFAULT_API,
            },
          },
        }
  const site = sites[siteKey]
  if (!site) {
    return null
  }
  return {
    ...site,
    assets: normalizeRuntimeAssets(site.assets),
    api: trimSlashes(
      site.api || (siteKey === DEFAULT_SITE_KEY ? DEFAULT_API : siteKey)
    ),
  }
}

function normalizeRuntimeAssets(assets?: FrontSiteAssets) {
  if (!assets) {
    return {}
  }
  return {
    logo: normalizeRuntimeAssetValue(assets.logo),
    favicon: normalizeRuntimeAssetValue(assets.favicon),
  }
}

function normalizeRuntimeAssetValue(value?: string) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }
  if (
    /^https?:\/\//i.test(normalized) ||
    normalized.startsWith('/') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:')
  ) {
    return normalized
  }
  return trimAssetPrefix(trimSlashes(normalized))
}

function runtimeSiteAssetUrl(siteKey: string, assetValue?: string) {
  const value = normalizeRuntimeAssetValue(assetValue)
  if (!value) {
    return ''
  }
  if (
    /^https?:\/\//i.test(value) ||
    value.startsWith('/') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value
  }
  return `/${siteKey}/assets/${trimAssetPrefix(value)}`
}

function trimAssetPrefix(value: string) {
  return trimSlashes(value).replace(/^assets\//, '')
}

function fallbackAssetPath(assetPath: string) {
  return path.posix.join('images', path.posix.basename(assetPath))
}

function readFrontConfig(projectRoot: string): FrontConfig {
  for (const fileName of ['front.jsonc', 'front.json']) {
    const filePath = path.join(projectRoot, 'backend', 'config', fileName)
    if (!fs.existsSync(filePath)) {
      continue
    }
    const content = stripJsonComments(fs.readFileSync(filePath, 'utf8'))
    return JSON.parse(content) as FrontConfig
  }
  return {}
}

function stripJsonComments(content: string) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function requestHostname(hostHeader: string | undefined) {
  const host = String(hostHeader || '').trim()
  if (!host) {
    return 'localhost'
  }
  return host.split(':')[0] || 'localhost'
}

function trimSlashes(value: string) {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
}
