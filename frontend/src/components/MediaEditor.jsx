import { Film, ImagePlus, Link2, ListChecks, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../api/client'
import { useToast } from '../context/ToastContext'
import { Button, Input } from './ui'

const MAX_IMAGES = 6
const MB = 1024 * 1024
const MAX_VIDEO_MB = 20
const PIECE = 3 * MB
const MAX_POINTS = 8

/**
 * Photos, video and key points for one product.
 * base: '/seller/products/12' or '/admin/products/12' — both offer the same routes.
 */
export default function MediaEditor({ product, base, onChange }) {
  return (
    <div className="space-y-6">
      <VideoEditor product={product} base={base} onChange={onChange} />
      <PhotoEditor product={product} base={base} onChange={onChange} />
      <KeyPointsEditor product={product} base={base} onChange={onChange} />
    </div>
  )
}

function Section({ icon: Icon, title, hint, children }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-brand-700" /> {title}</h3>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p>}
      {children}
    </div>
  )
}

function VideoEditor({ product, base, onChange }) {
  const toast = useToast()
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState('')
  const v = product.video

  const run = async (what, fn, done) => {
    setBusy(what)
    try {
      onChange((await fn()).data)
      toast.success(done)
      setLink('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy('')
    }
  }
  const [progress, setProgress] = useState(0)

  // Sent in 3 MB pieces: the server can only accept about 4.5 MB per request.
  const upload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!['video/mp4', 'video/webm'].includes(file.type)) return toast.error('Please choose an MP4 or WebM video.')
    if (file.size > MAX_VIDEO_MB * MB) return toast.error(`Videos can be up to ${MAX_VIDEO_MB} MB. For longer videos, upload to YouTube and paste the link.`)
    const total = Math.ceil(file.size / PIECE)
    const uploadId = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
    setBusy('upload')
    setProgress(0)
    try {
      for (let i = 0; i < total; i++) {
        const fd = new FormData()
        fd.append('upload_id', uploadId)
        fd.append('index', i)
        fd.append('total', total)
        fd.append('content_type', file.type)
        fd.append('chunk', file.slice(i * PIECE, (i + 1) * PIECE), 'piece')
        const { data } = await api.post(`${base}/video/chunk`, fd)
        setProgress(Math.round(((i + 1) / total) * 100))
        if (data.done) onChange(data.product)
      }
      toast.success('Video uploaded')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy('')
      setProgress(0)
    }
  }

  return (
    <Section icon={Film} title="Video" hint="Shown first in the product gallery. Upload an MP4 or WebM from your computer (up to 20 MB, about 1–2 minutes), or paste a YouTube / Vimeo link for longer videos.">
      {v ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-canvas p-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-brand-900 text-white"><Film className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium capitalize">{v.kind === 'file' ? 'Video file' : `${v.kind} video`}</div>
            <a href={v.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-brand-700 hover:underline">{v.url}</a>
          </div>
          <Button type="button" size="sm" variant="danger-soft" loading={busy === 'remove'} onClick={() => run('remove', () => api.delete(`${base}/video`), 'Video removed')}>
            <Trash2 className="size-4" /> Remove
          </Button>
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" type="url" placeholder={v ? 'Replace with a new link…' : 'https://youtu.be/…'} value={link} onChange={(e) => setLink(e.target.value)} aria-label="Video link" />
        </div>
        <Button type="button" variant="secondary" disabled={!link.trim()} loading={busy === 'link'} onClick={() => run('link', () => api.put(`${base}/video`, { url: link.trim() }), 'Video saved')}>Save link</Button>
        <label className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold hover:bg-brand-50 ${busy === 'upload' ? 'pointer-events-none opacity-60' : ''}`}>
          <Upload className="size-4" /> {busy === 'upload' ? `Uploading… ${progress}%` : 'Upload from computer'}
          <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={upload} />
        </label>
      </div>
      {busy === 'upload' && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand-700 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </Section>
  )
}

function PhotoEditor({ product, base, onChange }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const pick = async (e) => {
    const files = [...e.target.files].slice(0, MAX_IMAGES - product.images.length)
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f))
      onChange((await api.post(`${base}/images`, fd)).data)
      toast.success(files.length > 1 ? `${files.length} photos added` : 'Photo added')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const remove = async (img) => {
    try {
      onChange((await api.delete(`${base}/images/${img.id}`)).data)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Section icon={ImagePlus} title={`Photos (${product.images.length}/${MAX_IMAGES})`} hint="The first photo is the cover on product cards. JPG, PNG or WebP under 4 MB; resized automatically.">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {product.images.map((img, i) => (
          <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl bg-canvas">
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">Cover</span>}
            <button type="button" onClick={() => remove(img)} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-red-600 shadow" aria-label="Remove photo"><X className="size-4" /></button>
          </div>
        ))}
        {product.images.length < MAX_IMAGES && (
          <label className={`grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 text-brand-700 hover:bg-brand-50 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            <div className="text-center text-xs font-medium"><ImagePlus className="mx-auto mb-1 size-6" />{busy ? 'Uploading…' : 'Add photos'}</div>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={pick} />
          </label>
        )}
      </div>
    </Section>
  )
}

function KeyPointsEditor({ product, base, onChange }) {
  const toast = useToast()
  const [points, setPoints] = useState(product.key_points?.length ? product.key_points : [''])
  const [busy, setBusy] = useState(false)
  useEffect(() => { setPoints(product.key_points?.length ? product.key_points : ['']) }, [product.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true)
    try {
      const data = (await api.patch(base, { key_points: points.filter((p) => p.trim()) })).data
      onChange(data)
      setPoints(data.key_points.length ? data.key_points : [''])
      toast.success('Key points saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section icon={ListChecks} title="Key points" hint="Short highlights shown beside the photos, e.g. “Pure mulberry silk with real zari”. Up to 8.">
      <div className="space-y-2">
        {points.map((pt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{i + 1}</span>
            <Input maxLength={160} value={pt} onChange={(e) => setPoints(points.map((p, j) => (j === i ? e.target.value : p)))} aria-label={`Key point ${i + 1}`} />
            <button type="button" onClick={() => setPoints(points.length > 1 ? points.filter((_, j) => j !== i) : [''])} className="grid size-9 shrink-0 place-items-center rounded-full text-red-600 hover:bg-red-50" aria-label={`Remove key point ${i + 1}`}><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {points.length < MAX_POINTS && <Button type="button" size="sm" variant="outline" onClick={() => setPoints([...points, ''])}><Plus className="size-4" /> Add point</Button>}
        <Button type="button" size="sm" loading={busy} onClick={save}>Save key points</Button>
      </div>
    </Section>
  )
}
