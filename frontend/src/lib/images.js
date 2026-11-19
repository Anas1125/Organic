/**
 * Shrink a photo in the browser before uploading it. The host (Vercel) rejects uploads
 * over ~4.5 MB, and the server resizes to 1600 px anyway, so big phone photos and
 * AI-generated PNG logos are reduced here first. Transparency is kept (WebP / PNG).
 * Returns the original file if it's already small or the browser can't re-encode it.
 */
export async function shrinkImage(file, { maxSide = 1600, quality = 0.86, skipUnder = 900 * 1024 } = {}) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/svg+xml') return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= skipUnder) {
    bitmap.close?.()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const encode = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q))
  // WebP keeps transparency and is small; older Safari can't encode it and returns PNG.
  let blob = await encode('image/webp', quality)
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/png')
  if (!blob || blob.size >= file.size) return file
  const ext = blob.type === 'image/webp' ? 'webp' : 'png'
  const name = file.name.replace(/\.[^.]+$/, '') || 'image'
  return new File([blob], `${name}.${ext}`, { type: blob.type })
}

export const shrinkAll = (files, opts) => Promise.all([...files].map((f) => shrinkImage(f, opts)))
