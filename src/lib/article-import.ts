import { joinFrontApi, request } from './request'

export type ArticleRemoteMediaAsset = {
  kind: 'image' | 'video' | 'audio'
  sourceUrl: string
  name: string
}

export type ImportedArticle = {
  title: string
  html: string
  assets: ArticleRemoteMediaAsset[]
  sourceURL: string
  site: string
}

type ImportArticleResponse = {
  title?: string
  html?: string
  assets?: Array<{
    kind?: string
    sourceUrl?: string
    source_url?: string
    name?: string
  }>
  source_url?: string
  sourceURL?: string
  site?: string
}

export async function importArticleFromURL(url: string, options?: { maxImages?: number }) {
  const result = await request(joinFrontApi('article/import_url'), 'post', {
    url,
    max_images: options?.maxImages,
  })
  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '导入文章失败')
  }
  return normalizeImportedArticle(result.data as ImportArticleResponse)
}

function normalizeImportedArticle(payload: ImportArticleResponse): ImportedArticle {
  return {
    title: String(payload.title || '').trim(),
    html: String(payload.html || '').trim(),
    assets: normalizeArticleAssets(payload.assets),
    sourceURL: String(payload.sourceURL || payload.source_url || '').trim(),
    site: String(payload.site || '').trim(),
  }
}

function normalizeArticleAssets(
  assets: ImportArticleResponse['assets']
): ArticleRemoteMediaAsset[] {
  if (!Array.isArray(assets)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: ArticleRemoteMediaAsset[] = []
  assets.forEach((asset) => {
    const kind = normalizeAssetKind(asset.kind)
    const sourceUrl = String(asset.sourceUrl || asset.source_url || '').trim()
    if (!kind || !sourceUrl) {
      return
    }
    const key = `${kind}:${sourceUrl}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    normalized.push({
      kind,
      sourceUrl,
      name: String(asset.name || '').trim() || 'article-resource',
    })
  })
  return normalized
}

function normalizeAssetKind(kind: unknown): ArticleRemoteMediaAsset['kind'] | '' {
  switch (String(kind || '').trim().toLowerCase()) {
    case 'image':
      return 'image'
    case 'video':
      return 'video'
    case 'audio':
      return 'audio'
    default:
      return ''
  }
}
