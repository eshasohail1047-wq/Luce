export type FetchedProductPage = {
  url: string
  title?: string
  description?: string
  images: string[]
}

export type FetchedRemoteMedia = {
  dataUrl: string
  contentType: string
  kind: 'image' | 'video'
  byteLength: number
}

export async function requestFetchProductPage(
  productUrl: string,
): Promise<FetchedProductPage> {
  const res = await fetch('/api/fetch-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: productUrl.trim() }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    url?: string
    title?: string
    description?: string
    images?: string[]
  }
  if (!res.ok || !data.ok || !Array.isArray(data.images) || !data.images.length) {
    throw new Error(data.error || `Could not fetch product photos (${res.status})`)
  }
  return {
    url: data.url || productUrl.trim(),
    title: data.title,
    description: data.description,
    images: data.images,
  }
}

export async function requestFetchRemoteMedia(
  mediaUrl: string,
  prefer: 'image' | 'video' | 'any' = 'any',
): Promise<FetchedRemoteMedia> {
  const res = await fetch('/api/fetch-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: mediaUrl.trim(), prefer }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    dataUrl?: string
    contentType?: string
    kind?: 'image' | 'video'
    byteLength?: number
  }
  if (!res.ok || !data.ok || !data.dataUrl) {
    throw new Error(data.error || `Could not fetch media (${res.status})`)
  }
  return {
    dataUrl: data.dataUrl,
    contentType: data.contentType || 'application/octet-stream',
    kind: data.kind === 'video' ? 'video' : 'image',
    byteLength: data.byteLength || 0,
  }
}

export async function remoteMediaToFile(
  media: FetchedRemoteMedia,
  filename = 'media',
): Promise<File> {
  const res = await fetch(media.dataUrl)
  const blob = await res.blob()
  const type = media.contentType || blob.type || 'application/octet-stream'
  const ext = type.includes('png')
    ? 'png'
    : type.includes('webp')
      ? 'webp'
      : type.includes('gif')
        ? 'gif'
        : type.includes('webm')
          ? 'webm'
          : type.includes('quicktime') || type.includes('mov')
            ? 'mov'
            : type.startsWith('video/')
              ? 'mp4'
              : 'jpg'
  const name = filename.includes('.') ? filename : `${filename}.${ext}`
  return new File([blob], name, { type })
}
