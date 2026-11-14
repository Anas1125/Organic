import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ProductImage } from './product'

/** Video first, then photos. Arrows, swipe, keyboard and thumbnails. */
export default function ProductGallery({ product }) {
  const slides = [
    ...(product.video ? [{ type: 'video', ...product.video }] : []),
    ...product.images.map((im) => ({ type: 'image', ...im })),
  ]
  const [index, setIndex] = useState(0)
  const touch = useRef(null)
  const count = slides.length

  useEffect(() => { setIndex(0) }, [product.id])

  const go = (step) => setIndex((i) => (i + step + count) % count)

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') go(-1)
    if (e.key === 'ArrowRight') go(1)
  }
  const onTouchStart = (e) => { touch.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touch.current == null) return
    const dx = e.changedTouches[0].clientX - touch.current
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
    touch.current = null
  }

  if (!count) {
    return <div className="card aspect-square overflow-hidden"><ProductImage product={product} iconSize="size-28" /></div>
  }

  return (
    <div>
      <div
        className="card group relative aspect-square overflow-hidden bg-black/5 outline-none"
        // A hidden-overflow box can still be scrolled sideways when the video or a button
        // takes focus, which shifts the slides off-centre. Keep it pinned.
        onScroll={(e) => { e.currentTarget.scrollLeft = 0 }}
        tabIndex={0}
        onKeyDown={onKey}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${product.name} photos and video`}
      >
        <div className="flex h-full transition-transform duration-300 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((sl, i) => (
            <div key={sl.type + (sl.id ?? 'v')} className="h-full w-full shrink-0" aria-hidden={i !== index}>
              {sl.type === 'image'
                ? <img src={sl.url} alt={`${product.name} — photo ${i + 1}`} className="h-full w-full object-cover" loading={i ? 'lazy' : 'eager'} />
                : <VideoSlide video={sl} active={i === index} title={product.name} />}
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" aria-label="Previous">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" aria-label="Next">
              <ChevronRight className="size-5" />
            </button>
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-2 py-1 backdrop-blur">
              {slides.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`} />)}
            </div>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {slides.map((sl, i) => (
            <button
              key={sl.type + (sl.id ?? 'v')}
              type="button"
              onClick={() => setIndex(i)}
              className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-brand-900 sm:size-20 ${i === index ? 'border-brand-700' : 'border-transparent opacity-80 hover:opacity-100'}`}
              aria-label={sl.type === 'video' ? 'Play video' : `Photo ${i + 1}`}
            >
              {sl.type === 'image'
                ? <img src={sl.url} alt="" className="h-full w-full object-cover" />
                : (
                  <>
                    {sl.thumbnail
                      ? <img src={sl.thumbnail} alt="" className="h-full w-full object-cover opacity-70" />
                      : product.images[0] && <img src={product.images[0].url} alt="" className="h-full w-full object-cover opacity-50" />}
                    <span className="absolute inset-0 grid place-items-center"><span className="grid size-8 place-items-center rounded-full bg-white/90 text-brand-800"><Play className="ml-0.5 size-4 fill-current" /></span></span>
                  </>
                )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function VideoSlide({ video, active, title }) {
  const ref = useRef(null)
  // Pause an uploaded clip when the buyer swipes away from it.
  useEffect(() => { if (!active) ref.current?.pause() }, [active])

  if (video.kind === 'file') {
    return <video ref={ref} src={video.url} className="h-full w-full bg-black object-contain" controls playsInline muted autoPlay={active} loop preload="metadata" />
  }
  // YouTube / Vimeo: only load the player while its slide is showing.
  return active
    ? <iframe src={video.embed_url} title={`${title} video`} className="h-full w-full bg-black" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
    : <div className="h-full w-full bg-black" />
}
