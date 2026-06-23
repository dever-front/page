import { normalizePath, type PluginOption } from 'vite'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { URL } from 'node:url'

type FrontRuntimePluginOptions = {
  projectRoot: string
}

type FrontConfig = {
  sites?: Record<string, FrontSite>
  public?: string[]
}

type ComponentManifest = {
  name?: string
  front?: FrontConfig
}

type FrontSite = {
  name?: string
  subtitle?: string
  description?: string
  url?: string[]
  logo?: string
  favicon?: string
  api?: string
  assets?: FrontSiteAssets
  config?: FrontSiteConfig
  setting?: FrontSiteSetting
  access?: {
    mode?: string
    authProvider?: string
  }
  public?: string[]
  entry?: string
  auth?: unknown[]
}

type FrontSiteConfig = {
  name?: string
  subtitle?: string
  description?: string
  url?: string[]
  logo?: string
  favicon?: string
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
    plugins?: Array<string | RuntimePluginDescriptor>
  }
}

type RuntimePluginDescriptor = {
  name: string
  manifest?: string
  entry?: string
  css?: string[]
  nodes?: string[]
  depends?: string[]
  module?: boolean
}

type PluginSourceMetadata = {
  name: string
  nodes?: string[]
  depends?: string[]
}

const DEFAULT_SITE_KEY = 'admin'
const DEFAULT_API = 'front'
const DEFAULT_ACCESS_MODE = 'rbac'
const DEV_API_PREFIX = '/__dever_api'
const DEFAULT_DEV_BACKEND_PORT = '8085'
const RUNTIME_HTML_PLACEHOLDER = '<!-- dever:runtime -->'
const PLUGIN_SOURCE_MOUNT_DIR = 'plugins-src'
const PLUGIN_MANIFEST = 'manifest.json'
const PLUGIN_SOURCE_ENTRY = 'plugin.ts'
const PLUGIN_DEV_RUNTIME = 'runtime.js'

export function deverRuntimePlugin({
  projectRoot,
}: FrontRuntimePluginOptions): PluginOption {
  return {
    name: 'dever-front-runtime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void (async () => {
          const pathname = requestPathname(req.url || '')
          const hostSiteKey = runtimeSiteKeyFromHost(
            projectRoot,
            req.headers.host
          )
          const apiProxy = devAPIProxyTarget(
            projectRoot,
            req.url || '',
            req.headers.host
          )
          if (apiProxy) {
            proxyDevAPI(req, res, apiProxy)
            return
          }

          const pluginSourceAsset = runtimePluginSourceAsset(
            projectRoot,
            pathname,
            hostSiteKey
          )
          if (pluginSourceAsset) {
            sendPluginSourceAsset(res, pluginSourceAsset)
            return
          }

          const siteAsset = runtimeSiteAsset(
            projectRoot,
            pathname,
            hostSiteKey
          )
          if (siteAsset) {
            sendRuntimeAsset(res, siteAsset)
            return
          }

          const defaultSiteKey = defaultRuntimeSiteKey(projectRoot)
          if (pathname === '/' && hostSiteKey) {
            const site = loadRuntimeSite(projectRoot, hostSiteKey)
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
                runtimePayload(projectRoot, hostSiteKey, site, '/')
              )
            )
            res.statusCode = 200
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(html)
            return
          }
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
            req.headers.referer,
            req.headers.host
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
              runtimeScript(
                runtimePayload(
                  projectRoot,
                  runtimeKey,
                  site,
                  hostSiteKey === runtimeKey ? '/' : `/${runtimeKey}`
                )
              )
            )
            return
          }

          const htmlSiteKey = htmlRuntimeSiteKey(
            projectRoot,
            pathname,
            req.headers.host
          )
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
              runtimePayload(
                projectRoot,
                htmlSiteKey,
                site,
                hostSiteKey === htmlSiteKey ? '/' : `/${htmlSiteKey}`
              )
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

function htmlRuntimeSiteKey(
  projectRoot: string,
  pathname: string,
  hostHeader?: string | string[]
) {
  if (path.posix.extname(pathname)) {
    return ''
  }

  const hostSiteKey = runtimeSiteKeyFromHost(projectRoot, hostHeader)
  if (hostSiteKey) {
    return hostSiteKey
  }
  const siteKey = pathname.split('/').find(Boolean) || ''
  return siteKey && isRuntimeSiteKey(projectRoot, siteKey) ? siteKey : ''
}

function runtimePayload(
  projectRoot: string,
  siteKey: string,
  site: FrontSite,
  basePath = `/${siteKey}`
) {
  const apiPrefix = trimSlashes(site.api || DEFAULT_API)
  const runtimeSetting = site.setting?.runtime || {}
  return {
    siteKey,
    basePath,
    apiPrefix,
    apiHost: `${DEV_API_PREFIX}/${apiPrefix}/`,
    site: {
      name: site.name || siteKey,
      subtitle: site.subtitle,
      description: site.description,
      url: site.url?.[0],
      logo:
        runtimeSiteAssetUrl(basePath, site.assets?.logo) ||
        runtimeBaseURL(basePath, 'assets/images/logo.svg'),
      favicon:
        runtimeSiteAssetUrl(basePath, site.assets?.favicon) ||
        runtimeBaseURL(basePath, 'assets/images/favicon.svg'),
    },
    appearance: site.setting?.appearance || {},
    runtime: {
      ...runtimeSetting,
      plugins: runtimePluginDescriptors(
        projectRoot,
        basePath,
        runtimeSetting.plugins
      ),
    },
    access: {
      mode: site.access?.mode || 'rbac',
      authProvider: site.access?.authProvider || DEFAULT_API,
    },
  }
}

function runtimePluginDescriptors(
  projectRoot: string,
  basePath: string,
  configuredPlugins?: Array<string | RuntimePluginDescriptor>
) {
  const configured = Array.isArray(configuredPlugins) ? configuredPlugins : []
  const descriptors = configured.map((plugin) =>
    normalizeRuntimePluginDescriptor(projectRoot, basePath, plugin)
  )
  const seen = new Set(configured.map(runtimePluginName).filter(Boolean))

  for (const pluginName of discoverSourcePluginNames(projectRoot)) {
    if (seen.has(pluginName)) {
      continue
    }
    descriptors.push(
      sourceRuntimePluginDescriptor(projectRoot, basePath, pluginName)
    )
    seen.add(pluginName)
  }

  return descriptors
}

function normalizeRuntimePluginDescriptor(
  projectRoot: string,
  basePath: string,
  plugin: string | RuntimePluginDescriptor
): string | RuntimePluginDescriptor {
  if (typeof plugin !== 'string') {
    return plugin
  }
  const name = cleanPluginName(plugin)
  if (name && name === plugin.trim() && !/[/?#]/.test(plugin)) {
    return sourceRuntimePluginDescriptor(projectRoot, basePath, name)
  }
  return plugin
}

function runtimePluginName(plugin: string | RuntimePluginDescriptor) {
  if (typeof plugin === 'string') {
    return runtimePluginNameFromURL(plugin)
  }
  return (
    String(plugin.name || '').trim() ||
    runtimePluginNameFromURL(plugin.manifest || plugin.entry || '')
  )
}

function runtimePluginNameFromURL(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }
  if (cleanPluginName(normalized) === normalized && !/[/?#]/.test(normalized)) {
    return normalized
  }
  const parts = normalized.split('/').filter(Boolean)
  const pluginIndex = Math.max(
    parts.lastIndexOf('plugins'),
    parts.lastIndexOf(PLUGIN_SOURCE_MOUNT_DIR)
  )
  if (pluginIndex >= 0 && parts[pluginIndex + 1]) {
    return parts[pluginIndex + 1]
  }
  return ''
}

function cleanPluginName(value: string) {
  const normalized = String(value || '').trim().replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized === '.' || normalized === '..') {
    return ''
  }
  return normalized.includes('/') ? '' : normalized
}

function sourceRuntimePluginDescriptor(
  projectRoot: string,
  basePath: string,
  pluginName: string
): RuntimePluginDescriptor {
  const metadata = readPluginSourceMetadata(
    pluginName,
    path.join(
      resolvePluginSourceRoot(projectRoot, pluginName),
      PLUGIN_SOURCE_ENTRY
    )
  )
  const mount = runtimeBaseURL(basePath, `${PLUGIN_SOURCE_MOUNT_DIR}/${pluginName}`)
  return {
    name: metadata.name,
    manifest: `${mount}/${PLUGIN_MANIFEST}`,
    entry: `${mount}/${PLUGIN_DEV_RUNTIME}`,
    nodes: metadata.nodes,
    depends: metadata.depends,
    module: true,
  }
}

function devAPIProxyTarget(
  projectRoot: string,
  rawUrl: string,
  hostHeader?: string | string[]
) {
  const pathname = requestPathname(rawUrl)
  const apiMatch = pathname.match(/^\/__dever_api\/([^/]+)(\/.*)?$/)
  if (apiMatch?.[1]) {
    return devBackendURL(
      `/${apiMatch[1]}${apiMatch[2] || '/'}`,
      rawUrl,
      hostHeader
    )
  }

  if (isPublicBackendPath(projectRoot, pathname)) {
    return devBackendURL(pathname, rawUrl, hostHeader)
  }

  return null
}

function devBackendURL(
  pathname: string,
  rawUrl: string,
  hostHeader?: string | string[]
) {
  const target = new URL(devBackendOrigin(hostHeader))
  const source = new URL(rawUrl, 'http://dever.local')
  target.pathname = pathname
  target.search = source.search
  return target
}

function devBackendOrigin(hostHeader?: string | string[]) {
  const configuredOrigin = String(
    process.env.VITE_DEVER_BACKEND_ORIGIN || ''
  ).trim()
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, '')
  }

  const hostname = requestHostname(hostHeader)
  return `http://${hostname}:${DEFAULT_DEV_BACKEND_PORT}`
}

function isPublicBackendPath(projectRoot: string, pathname: string) {
  return runtimePublicPaths(projectRoot).some((pattern) =>
    matchBackendPathPattern(pattern, pathname)
  )
}

function runtimePublicPaths(projectRoot: string) {
  const config = readFrontManifestConfig(projectRoot)
  const paths = Array.isArray(config.public) ? [...config.public] : []
  for (const site of Object.values(config.sites || {})) {
    const apiPrefix = trimSlashes(site.api || DEFAULT_API)
    if (site.access?.mode === 'public' && apiPrefix !== DEFAULT_API) {
      paths.push(`/${apiPrefix}/*`)
    }
    for (const item of site.public || []) {
      if (String(item || '').trim().startsWith('/')) {
        paths.push(String(item || '').trim())
        continue
      }
      paths.push(`/${apiPrefix}/${trimSlashes(item)}`)
    }
  }
  return uniqueStrings(paths)
}

function matchBackendPathPattern(pattern: string, pathname: string) {
  const normalizedPattern = `/${trimSlashes(pattern)}`
  if (!normalizedPattern || normalizedPattern === '/') {
    return false
  }
  if (normalizedPattern.endsWith('/*')) {
    return pathname.startsWith(normalizedPattern.slice(0, -1))
  }
  return pathname === normalizedPattern
}

function proxyDevAPI(req: any, res: any, target: URL) {
  const client = target.protocol === 'https:' ? https : http
  const proxyReq = client.request(
    target,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
      },
    },
    (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 502
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value !== undefined) {
          res.setHeader(key, value as string | string[])
        }
      }
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('error', (error) => {
    res.statusCode = 502
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(`Dever dev backend proxy failed: ${error.message}`)
  })

  req.pipe(proxyReq)
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

function runtimeSiteAsset(
  projectRoot: string,
  pathname: string,
  hostSiteKey = ''
) {
  const hostAssetMatch = pathname.match(/^\/assets\/([^/][^?]*)$/)
  if (hostSiteKey && hostAssetMatch?.[1]) {
    return (
      existingSafePath(frontAssetRoot(projectRoot, hostSiteKey), hostAssetMatch[1]) ||
      existingSafePath(
        frontAssetRoot(projectRoot, DEFAULT_SITE_KEY),
        fallbackAssetPath(hostAssetMatch[1])
      )
    )
  }

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

type PluginSourceAsset = {
  pluginName: string
  sourceRoot: string
  rel: string
}

function runtimePluginSourceAsset(
  projectRoot: string,
  pathname: string,
  hostSiteKey = ''
): PluginSourceAsset | null {
  if (hostSiteKey) {
    const hostPattern = new RegExp(
      `^\\/${PLUGIN_SOURCE_MOUNT_DIR}\\/([^/]+)\\/(.+)$`
    )
    const hostMatch = pathname.match(hostPattern)
    if (hostMatch?.[1] && hostMatch?.[2]) {
      const sourceRoot = resolvePluginSourceRoot(projectRoot, hostMatch[1])
      return sourceRoot
        ? { pluginName: hostMatch[1], sourceRoot, rel: hostMatch[2] }
        : null
    }
  }

  const pattern = new RegExp(
    `^\\/([^/]+)\\/${PLUGIN_SOURCE_MOUNT_DIR}\\/([^/]+)\\/(.+)$`
  )
  const match = pathname.match(pattern)
  const siteKey = match?.[1] || ''
  const pluginName = match?.[2] || ''
  const rel = match?.[3] || ''
  if (
    !siteKey ||
    !pluginName ||
    !rel ||
    !isRuntimeSiteKey(projectRoot, siteKey)
  ) {
    return null
  }

  const sourceRoot = resolvePluginSourceRoot(projectRoot, pluginName)
  if (!sourceRoot) {
    return null
  }
  return { pluginName, sourceRoot, rel }
}

function sendPluginSourceAsset(res: any, asset: PluginSourceAsset) {
  switch (asset.rel) {
    case PLUGIN_MANIFEST:
      sendPluginSourceManifest(res, asset.pluginName, asset.sourceRoot)
      return
    case PLUGIN_DEV_RUNTIME:
      sendPluginSourceRuntime(res, asset.sourceRoot)
      return
    default:
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('front plugin source asset not found')
  }
}

function sendPluginSourceManifest(
  res: any,
  pluginName: string,
  sourceRoot: string
) {
  const metadata = readPluginSourceMetadata(
    pluginName,
    path.join(sourceRoot, PLUGIN_SOURCE_ENTRY)
  )
  const content = JSON.stringify({
    __plugin: metadata,
    [PLUGIN_DEV_RUNTIME]: {
      isEntry: true,
      file: PLUGIN_DEV_RUNTIME,
      module: true,
    },
  })
  res.statusCode = 200
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(content)
}

function sendPluginSourceRuntime(res: any, sourceRoot: string) {
  const entryFile = path.join(sourceRoot, PLUGIN_SOURCE_ENTRY)
  const content = `import plugin from ${JSON.stringify(viteFSURL(entryFile))};\nwindow.DeverFront?.registerPlugin(plugin);\n`
  res.statusCode = 200
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
  res.end(content)
}

function viteFSURL(filePath: string) {
  return `/@fs/${normalizePath(filePath)}`
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
  referer?: string | string[],
  hostHeader?: string | string[]
) {
  const pathname = requestPathname(rawUrl)
  const match = pathname.match(/^\/([^/]+)\/runtime\.js$/)
  if (match?.[1]) {
    return match[1]
  }

  if (pathname !== '/runtime.js') {
    return ''
  }

  const hostSiteKey = runtimeSiteKeyFromHost(projectRoot, hostHeader)
  if (hostSiteKey) {
    return hostSiteKey
  }

  const refererSiteKey = runtimeSiteKeyFromReferer(projectRoot, referer)
  return refererSiteKey || defaultRuntimeSiteKey(projectRoot)
}

function runtimeSiteKeyFromHost(
  projectRoot: string,
  hostHeader?: string | string[]
) {
  const host = normalizeHostHeader(hostHeader)
  if (!host) {
    return ''
  }
  const sites = readFrontManifestConfig(projectRoot).sites || {}
  for (const [siteKey, site] of Object.entries(sites)) {
    if (site.url?.some((item) => normalizeURLHost(item) === host)) {
      return siteKey
    }
  }
  return ''
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

function requestHostname(hostHeader?: string | string[]) {
  const rawHost = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  const host = String(rawHost || '').trim()
  if (!host) {
    return '127.0.0.1'
  }
  return host.split(':')[0] || '127.0.0.1'
}

function normalizeHostHeader(hostHeader?: string | string[]) {
  const rawValue = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  const firstValue = String(rawValue || '')
    .split(',')[0]
    .trim()
  if (!firstValue) {
    return ''
  }
  let withoutPath = firstValue.split('/')[0]
  if (firstValue.includes('://')) {
    try {
      withoutPath = new URL(firstValue).host
    } catch {
      return ''
    }
  }
  return normalizeHostPort(withoutPath, '')
}

function normalizeURLHost(value: string) {
  const raw = String(value || '').trim()
  if (!raw) {
    return ''
  }
  try {
    const parsed = new URL(raw)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return ''
    }
    return normalizeHostPort(parsed.host, parsed.protocol)
  } catch {
    return ''
  }
}

function normalizeHostPort(value: string, protocol: string) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '')
  if (!normalized) {
    return ''
  }
  const match = normalized.match(/^([^:]+):(\d+)$/)
  if (!match) {
    return normalized
  }
  const [, host, port] = match
  if (
    (protocol === 'http:' && port === '80') ||
    (protocol === 'https:' && port === '443') ||
    (!protocol && ['80', '443'].includes(port))
  ) {
    return host
  }
  return `${host}:${port}`
}

function defaultRuntimeSiteKey(projectRoot: string) {
  const sites = readFrontManifestConfig(projectRoot).sites || {}
  if (sites[DEFAULT_SITE_KEY]) {
    return DEFAULT_SITE_KEY
  }

  return Object.keys(sites).sort()[0] || DEFAULT_SITE_KEY
}

function isRuntimeSiteKey(projectRoot: string, siteKey: string) {
  const sites = readFrontManifestConfig(projectRoot).sites || {}
  if (Object.keys(sites).length === 0) {
    return siteKey === DEFAULT_SITE_KEY
  }
  return Boolean(sites[siteKey])
}

function loadRuntimeSite(
  projectRoot: string,
  siteKey: string
): FrontSite | null {
  const config = readFrontManifestConfig(projectRoot)
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

function discoverSourcePluginNames(projectRoot: string) {
  return [
    ...discoverSourcePluginNamesIn(
      path.join(projectRoot, 'backend', 'package')
    ),
    ...discoverSourcePluginNamesIn(path.join(projectRoot, 'backend', 'module')),
  ].sort()
}

function discoverSourcePluginNamesIn(root: string) {
  if (!fs.existsSync(root)) {
    return []
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((pluginName) =>
      fs.existsSync(
        path.join(root, pluginName, 'front', 'src', PLUGIN_SOURCE_ENTRY)
      )
    )
}

function resolvePluginSourceRoot(projectRoot: string, pluginName: string) {
  for (const root of [
    path.join(projectRoot, 'backend', 'package', pluginName, 'front', 'src'),
    path.join(projectRoot, 'backend', 'module', pluginName, 'front', 'src'),
  ]) {
    if (fs.existsSync(path.join(root, PLUGIN_SOURCE_ENTRY))) {
      return root
    }
  }
  return ''
}

function readPluginSourceMetadata(
  defaultName: string,
  entryFile: string
): PluginSourceMetadata {
  if (!fs.existsSync(entryFile)) {
    return { name: defaultName }
  }
  return extractPluginSourceMetadata(
    defaultName,
    fs.readFileSync(entryFile, 'utf8')
  )
}

function extractPluginSourceMetadata(
  defaultName: string,
  content: string
): PluginSourceMetadata {
  const metadata: PluginSourceMetadata = { name: defaultName }
  const name = extractStringProperty(content, 'name')
  if (name) {
    metadata.name = name
  }

  const nodesBlock = extractPropertyBlock(content, 'nodes', '{', '}')
  if (nodesBlock) {
    metadata.nodes = extractObjectStringKeys(nodesBlock)
  }

  const dependsBlock = extractPropertyBlock(content, 'depends', '[', ']')
  if (dependsBlock) {
    metadata.depends = extractStringLiterals(dependsBlock)
  }
  return metadata
}

function extractStringProperty(content: string, key: string) {
  const match = content.match(
    new RegExp(`\\b${escapeRegExp(key)}\\s*:\\s*${stringLiteralPattern()}`)
  )
  return match?.[1]?.trim() || ''
}

function extractPropertyBlock(
  content: string,
  key: string,
  open: string,
  close: string
) {
  const matcher = new RegExp(`\\b${escapeRegExp(key)}\\s*:`, 'g')
  let match: RegExpExecArray | null
  while ((match = matcher.exec(content))) {
    let index = match.index + match[0].length
    while (index < content.length && /\s/.test(content[index])) {
      index++
    }
    if (content[index] !== open) {
      continue
    }
    return matchDelimitedBlock(content, index, open, close)
  }
  return ''
}

function matchDelimitedBlock(
  content: string,
  start: number,
  open: string,
  close: string
) {
  let depth = 0
  let inString = ''
  let escaped = false

  for (let index = start; index < content.length; index++) {
    const current = content[index]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (current === '\\') {
        escaped = true
        continue
      }
      if (current === inString) {
        inString = ''
      }
      continue
    }

    if (current === '"' || current === "'" || current === '`') {
      inString = current
      continue
    }
    if (current === open) {
      depth++
      continue
    }
    if (current === close) {
      depth--
      if (depth === 0) {
        return content.slice(start, index + 1)
      }
    }
  }
  return ''
}

function extractObjectStringKeys(block: string) {
  const values: string[] = []
  const matcher = new RegExp(`${stringLiteralPattern()}\\s*:`, 'g')
  let match: RegExpExecArray | null
  while ((match = matcher.exec(block))) {
    values.push(match[1].trim())
  }
  return uniqueStrings(values)
}

function extractStringLiterals(block: string) {
  const values: string[] = []
  const matcher = new RegExp(stringLiteralPattern(), 'g')
  let match: RegExpExecArray | null
  while ((match = matcher.exec(block))) {
    values.push(match[1].trim())
  }
  return uniqueStrings(values)
}

function stringLiteralPattern() {
  return `["'\`]([^"'\\\`]+)["'\`]`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => String(value || '').trim()).filter(Boolean))
  )
}

function runtimeSiteAssetUrl(basePath: string, assetValue?: string) {
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
  return runtimeBaseURL(basePath, `assets/${trimAssetPrefix(value)}`)
}

function runtimeBaseURL(basePath: string, relativePath: string) {
  const base = `/${trimSlashes(basePath)}`
  const rel = trimSlashes(relativePath)
  if (base === '/') {
    return `/${rel}`
  }
  return `${base}/${rel}`
}

function trimAssetPrefix(value: string) {
  return trimSlashes(value).replace(/^assets\//, '')
}

function fallbackAssetPath(assetPath: string) {
  return path.posix.join('images', path.posix.basename(assetPath))
}

function readFrontManifestConfig(projectRoot: string): FrontConfig {
  const config: FrontConfig = {
    public: [],
    sites: {},
  }
  const owners: Record<string, string> = {}

  for (const manifestPath of discoverComponentManifestPaths(projectRoot)) {
    const manifest = readComponentManifest(manifestPath)
    const componentName = trimSlashes(
      manifest.name || path.basename(path.dirname(manifestPath))
    )
    const front = manifest.front || {}
    config.public?.push(...normalizeStringList(front.public))
    for (const [rawSiteKey, rawSite] of Object.entries(front.sites || {})) {
      const siteKey = trimSlashes(rawSiteKey)
      if (!siteKey) {
        continue
      }
      const current = config.sites?.[siteKey] || defaultRuntimeSite(siteKey)
      if (hasRuntimeSiteOwnerFields(rawSite)) {
        const owner = owners[siteKey]
        if (owner && owner !== componentName) {
          throw new Error(
            `front site "${siteKey}" is defined by both ${owner} and ${componentName}`
          )
        }
        owners[siteKey] = componentName
        config.sites![siteKey] = mergeRuntimeSiteOwnerFields(
          current,
          rawSite,
          siteKey
        )
        continue
      }
      config.sites![siteKey] = mergeRuntimeSiteContributions(
        current,
        rawSite
      )
    }
  }

  for (const siteKey of Object.keys(config.sites || {})) {
    if (siteKey !== DEFAULT_SITE_KEY && !owners[siteKey]) {
      delete config.sites![siteKey]
    }
  }
  if (!config.sites || Object.keys(config.sites).length === 0) {
    config.sites = {
      [DEFAULT_SITE_KEY]: defaultRuntimeSite(DEFAULT_SITE_KEY),
    }
  }

  applyProjectFrontConfig(projectRoot, config)

  config.public = uniqueStrings(config.public || [])
  if (config.sites && Object.keys(config.sites).length > 0) {
    for (const [siteKey, site] of Object.entries(config.sites)) {
      config.sites[siteKey] = normalizeRuntimeSite(site, siteKey)
    }
  }
  return config
}

function discoverComponentManifestPaths(projectRoot: string) {
  return [
    ...discoverComponentManifestPathsIn(
      path.join(projectRoot, 'backend', 'package')
    ),
    ...discoverComponentManifestPathsIn(
      path.join(projectRoot, 'backend', 'module')
    ),
  ].sort()
}

function discoverComponentManifestPathsIn(root: string) {
  if (!fs.existsSync(root)) {
    return []
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'dever.json'))
    .filter((filePath) => fs.existsSync(filePath))
}

function readComponentManifest(filePath: string): ComponentManifest {
  const content = stripJsonComments(fs.readFileSync(filePath, 'utf8'))
  return JSON.parse(content) as ComponentManifest
}

function applyProjectFrontConfig(projectRoot: string, config: FrontConfig) {
  const projectConfig = readProjectFrontConfig(projectRoot)
  const sites = projectConfig.sites || {}
  for (const [rawSiteKey, override] of Object.entries(sites)) {
    const siteKey = trimSlashes(rawSiteKey)
    if (!siteKey) {
      continue
    }
    const current = config.sites?.[siteKey]
    if (!current) {
      throw new Error(`config/front 定义了未知站点 "${siteKey}"`)
    }
    const normalizedOverride = normalizeProjectSiteOverride(override, siteKey)
    config.sites![siteKey] = {
      ...current,
      ...normalizedOverride,
      assets: normalizedOverride.assets
        ? {
            ...(current.assets || {}),
            ...normalizedOverride.assets,
          }
        : current.assets,
    }
  }
}

function readProjectFrontConfig(projectRoot: string): FrontConfig {
  for (const filePath of [
    path.join(projectRoot, 'backend', 'config', 'front.json'),
    path.join(projectRoot, 'backend', 'config', 'front.jsonc'),
  ]) {
    if (!fs.existsSync(filePath)) {
      continue
    }
    const content = stripJsonComments(fs.readFileSync(filePath, 'utf8'))
    return JSON.parse(content) as FrontConfig
  }
  return {}
}

function normalizeProjectSiteOverride(site: FrontSite, siteKey: string) {
  if (site.url !== undefined && !Array.isArray(site.url)) {
    throw new Error(`config/front sites.${siteKey}.url 必须是字符串数组`)
  }
  const override: FrontSite = {}
  if (stringValue(site.name)) {
    override.name = stringValue(site.name)
  }
  if (stringValue(site.subtitle)) {
    override.subtitle = stringValue(site.subtitle)
  }
  if (stringValue(site.description)) {
    override.description = stringValue(site.description)
  }
  if (site.url !== undefined) {
    override.url = normalizeStringList(site.url)
  }
  const logo = stringValue(site.logo || site.assets?.logo)
  const favicon = stringValue(site.favicon || site.assets?.favicon)
  if (logo || favicon) {
    override.assets = normalizeRuntimeAssets({
      logo: logo || site.assets?.logo,
      favicon: favicon || site.assets?.favicon,
    })
  }
  return override
}

function defaultRuntimeSite(siteKey: string): FrontSite {
  return {
    api: siteKey === DEFAULT_SITE_KEY ? DEFAULT_API : siteKey,
    access: {
      mode: DEFAULT_ACCESS_MODE,
      authProvider: DEFAULT_API,
    },
  }
}

function hasRuntimeSiteOwnerFields(site: FrontSite) {
  const siteConfig = site.config || {}
  return Boolean(
    stringValue(siteConfig.name || site.name) ||
      stringValue(siteConfig.subtitle || site.subtitle) ||
      stringValue(siteConfig.description || site.description) ||
      normalizeStringList(siteConfig.url || site.url).length > 0 ||
      stringValue(site.api) ||
      stringValue(site.entry) ||
      stringValue(siteConfig.logo || site.logo || site.assets?.logo) ||
      stringValue(siteConfig.favicon || site.favicon || site.assets?.favicon) ||
      stringValue(site.access?.mode) ||
      stringValue(site.access?.authProvider) ||
      stringValue(site.setting?.appearance?.theme) ||
      stringValue(site.setting?.appearance?.sidebar) ||
      stringValue(site.setting?.appearance?.layout) ||
      stringValue(site.setting?.appearance?.direction) ||
      stringValue(site.setting?.runtime?.skin) ||
      stringValue(site.setting?.runtime?.routerMode) ||
      (Array.isArray(site.setting?.runtime?.plugins) &&
        site.setting!.runtime!.plugins!.length > 0)
  )
}

function mergeRuntimeSiteOwnerFields(
  current: FrontSite,
  incoming: FrontSite,
  siteKey: string
): FrontSite {
  const siteConfig = incoming.config || incoming
  return mergeRuntimeSiteContributions(
    {
      ...current,
      ...incoming,
      name: stringValue(siteConfig.name) || current.name,
      subtitle: stringValue(siteConfig.subtitle) || current.subtitle,
      description: stringValue(siteConfig.description) || current.description,
      url:
        normalizeStringList(siteConfig.url).length > 0
          ? normalizeStringList(siteConfig.url)
          : current.url,
      api: trimSlashes(
        incoming.api || (siteKey === DEFAULT_SITE_KEY ? DEFAULT_API : siteKey)
      ),
      assets: normalizeRuntimeAssets({
        logo: siteConfig.logo || incoming.logo || incoming.assets?.logo,
        favicon:
          siteConfig.favicon || incoming.favicon || incoming.assets?.favicon,
      }),
      access: normalizeRuntimeAccess(incoming.access),
      setting: normalizeRuntimeSetting(incoming.setting),
    },
    incoming
  )
}

function mergeRuntimeSiteContributions(
  current: FrontSite,
  incoming: FrontSite
): FrontSite {
  return {
    ...current,
    public: uniqueStrings([
      ...normalizeStringList(current.public),
      ...normalizeStringList(incoming.public),
    ]),
    auth: [...(current.auth || []), ...(incoming.auth || [])],
  }
}

function normalizeRuntimeSite(site: FrontSite, siteKey: string): FrontSite {
  return {
    ...site,
    api: trimSlashes(
      site.api || (siteKey === DEFAULT_SITE_KEY ? DEFAULT_API : siteKey)
    ),
    assets: normalizeRuntimeAssets(site.assets),
    access: normalizeRuntimeAccess(site.access),
    setting: normalizeRuntimeSetting(site.setting),
    public: normalizeStringList(site.public),
    url: normalizeStringList(site.url),
  }
}

function normalizeRuntimeAccess(access?: FrontSite['access']) {
  const mode = stringValue(access?.mode)
  return {
    mode: ['rbac', 'login', 'public'].includes(mode)
      ? mode
      : DEFAULT_ACCESS_MODE,
    authProvider: trimSlashes(access?.authProvider || DEFAULT_API),
  }
}

function normalizeRuntimeSetting(setting?: FrontSiteSetting) {
  return {
    appearance: setting?.appearance || {},
    runtime: {
      ...(setting?.runtime || {}),
      plugins: normalizeRuntimePluginValues(setting?.runtime?.plugins),
    },
  }
}

function normalizeRuntimePluginValues(
  plugins?: Array<string | RuntimePluginDescriptor>
) {
  return Array.isArray(plugins) ? plugins : undefined
}

function normalizeStringList(values?: unknown[]) {
  if (!Array.isArray(values)) {
    return []
  }
  return uniqueStrings(values.map((value) => String(value || '')))
}

function stringValue(value: unknown) {
  return String(value || '').trim()
}

function stripJsonComments(content: string) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function trimSlashes(value: string) {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
}
