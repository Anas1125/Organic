import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, MapPin, Pause, Play, Scale, ShieldCheck, Truck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// Photos: /public/hero (Wikimedia Commons — credits in backend/app/seed_images/CREDITS.md).
const SLIDES = [
  {
    tab: 'Silk sarees',
    eyebrow: 'Kanchipuram · Arani · Thirubuvanam',
    title: 'Pure silk, straight from the looms',
    text: 'GI-tagged silk sarees from Tamil Nadu’s weaving towns — for boutiques and showrooms, at wholesale prices.',
    cta: ['Shop silk sarees', '/shop?category=sarees-handlooms'],
    img: '/hero/kanchipuram-silk.webp',
    feature: { name: 'Kanchipuram Silk Saree', place: 'Kanchipuram' },
    tone: '#4a1d26',
    accent: '#e9b872',
  },
  {
    tab: 'Thanjavur art',
    eyebrow: 'Thanjavur · Swamimalai',
    title: 'Art with four centuries behind it',
    text: 'Thanjavur paintings, art plates, dolls and Swamimalai bronzes, made by the families who keep the craft alive.',
    cta: ['Explore Thanjavur', '/shop?district=Thanjavur'],
    img: '/hero/thanjavur-painting.webp',
    feature: { name: 'Thanjavur Painting', place: 'Thanjavur' },
    tone: '#33210e',
    accent: '#f0c674',
  },
  {
    tab: 'Spices',
    eyebrow: 'Erode · Ramanathapuram · Virudhunagar',
    title: 'Spices with a postcode',
    text: 'Erode turmeric, Mundu chilli and Samba vathal in 25–50 kg lots — the more you order, the lower the price.',
    cta: ['Shop spices', '/shop?category=spices'],
    img: '/hero/erode-turmeric.webp',
    feature: { name: 'Erode Manjal (Turmeric)', place: 'Erode' },
    tone: '#3f2a06',
    accent: '#f5c542',
  },
  {
    tab: 'Sweets & snacks',
    eyebrow: 'Kovilpatti · Manapparai · Palani',
    title: 'Sweets and snacks the whole state knows',
    text: 'Kadalai mittai, murukku, palkova and panchamirtham in fresh batches for retailers, sweet shops and caterers.',
    cta: ['Shop regional foods', '/shop?category=regional-specialties'],
    img: '/hero/kovilpatti-kadalai-mittai.webp',
    feature: { name: 'Kovilpatti Kadalai Mittai', place: 'Thoothukudi' },
    tone: '#4a2610',
    accent: '#f2b261',
  },
  {
    tab: 'Wholesale',
    eyebrow: 'Built for business buyers',
    title: 'Wholesale prices that drop as you order more',
    text: 'Every product has bulk tiers and minimum orders made for shops, hotels and exporters. Pay by UPI or cash on delivery.',
    cta: ['See bulk deals', '/shop?bulk=true'],
    img: '/hero/manapparai-murukku.webp',
    feature: { name: 'Manapparai Murukku', place: 'Tiruchirappalli' },
    tone: '#163a2d',
    accent: '#c9e3a7',
  },
  {
    tab: 'Sell with us',
    eyebrow: 'For GI producers and artisans',
    title: 'Sell your GI products across India',
    text: 'List your products, upload your GI and organic certificates once, and reach verified business buyers directly.',
    cta: ['Start selling', '/register?role=seller'],
    img: '/hero/swamimalai-bronze.webp',
    feature: { name: 'Swamimalai Bronze Icon', place: 'Thanjavur' },
    tone: '#12322a',
    accent: '#e3c27a',
  },
]

const DELAY = 7000

/** Faint kolam-style pattern behind the text. */
function Pattern({ color }) {
  const id = `kolam-${color.slice(1)}`
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]" aria-hidden>
      <defs>
        <pattern id={id} width="44" height="44" patternUnits="userSpaceOnUse">
          <circle cx="22" cy="22" r="1.6" fill={color} />
          <circle cx="0" cy="0" r="1.6" fill={color} />
          <circle cx="44" cy="0" r="1.6" fill={color} />
          <circle cx="0" cy="44" r="1.6" fill={color} />
          <circle cx="44" cy="44" r="1.6" fill={color} />
          <path d="M22 8 C30 14 30 30 22 36 C14 30 14 14 22 8 Z" fill="none" stroke={color} strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

export default function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false) // hover / focus
  const [stopped, setStopped] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })
  const touch = useRef(null)
  const count = SLIDES.length
  const go = useCallback((step) => setIndex((i) => (i + step + count) % count), [count])

  useEffect(() => {
    if (paused || stopped) return undefined
    const t = setTimeout(() => go(1), DELAY)
    return () => clearTimeout(t)
  }, [index, paused, stopped, go])

  const onTouchStart = (e) => { touch.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touch.current == null) return
    const dx = e.changedTouches[0].clientX - touch.current
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
    touch.current = null
  }
  const running = !(paused || stopped)
  const progress = () => running ? { animation: `hero-progress ${DELAY}ms linear forwards` } : { width: '100%' }

  return (
    <section className="container-page pt-4 sm:pt-8">
      <div
        className="relative overflow-hidden rounded-[32px] text-white shadow-[0_30px_60px_-30px_rgba(20,40,30,.55)]"
        style={{ background: SLIDES[index].tone, transition: 'background-color 800ms ease' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1) }}
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured collections"
      >
        <div className="relative h-[560px] sm:h-[500px] lg:h-[520px]">
          {SLIDES.map((s, i) => {
            const active = i === index
            return (
              <div
                key={s.title}
                className={`absolute inset-0 transition-opacity duration-700 ease-out ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                aria-hidden={!active}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}: ${s.title}`}
              >
                <Pattern color={s.accent} />

                {/* Photo: right side on desktop (with a soft curved edge), top on phones */}
                <div className="absolute inset-x-0 top-0 h-[52%] overflow-hidden sm:inset-y-0 sm:left-auto sm:h-full sm:w-[58%] sm:[clip-path:ellipse(100%_120%_at_100%_50%)]">
                  <img
                    src={s.img}
                    alt=""
                    className={`h-full w-full object-cover transition-transform duration-[8000ms] ease-out ${active ? 'scale-110' : 'scale-100'}`}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent sm:bg-gradient-to-r sm:from-black/25" />
                </div>
                <div className="absolute inset-0 sm:hidden" style={{ background: `linear-gradient(0deg, ${s.tone} 48%, ${s.tone}cc 56%, transparent 74%)` }} />

                {/* Floating "featured" card over the photo */}
                <div className={`absolute right-5 top-5 hidden items-center gap-3 rounded-2xl border border-white/25 bg-white/15 p-2.5 pr-4 shadow-lg backdrop-blur-md transition-all duration-700 sm:flex lg:right-8 lg:top-8 ${active ? 'translate-y-0 opacity-100 delay-300' : '-translate-y-2 opacity-0'}`}>
                  <img src={s.img} alt="" className="size-12 rounded-xl object-cover" />
                  <div>
                    <div className="text-sm font-semibold leading-tight">{s.feature.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/85">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/90 px-1.5 py-px font-semibold text-amber-950"><BadgeCheck className="size-3" /> GI-tagged</span>
                      <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{s.feature.place}</span>
                    </div>
                  </div>
                </div>

                <div className="relative flex h-full flex-col justify-end p-6 pb-28 sm:max-w-[52%] sm:justify-center sm:p-10 sm:pb-28 lg:p-14 lg:pb-32">
                  <div className={`transition-all duration-700 ${active ? 'translate-y-0 opacity-100 delay-150' : 'translate-y-4 opacity-0'}`}>
                    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] sm:text-xs" style={{ color: s.accent }}>
                      <span className="h-px w-8" style={{ background: s.accent }} />
                      {s.eyebrow}
                    </div>
                    <h1 className="mt-4 text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-[44px] lg:text-[54px]">{s.title}</h1>
                    <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">{s.text}</p>
                    <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
                      <Link to={s.cta[1]} tabIndex={active ? 0 : -1} className="group inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-ink shadow-lg transition hover:brightness-105 sm:text-base" style={{ background: s.accent }}>
                        {s.cta[0]} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                      </Link>
                      {i !== count - 1 && (
                        <Link to="/shop" tabIndex={active ? 0 : -1} className="hidden h-12 items-center rounded-full border border-white/35 px-6 font-semibold text-white transition hover:bg-white/10 sm:inline-flex">
                          Browse all
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Trust strip */}
          <div className="absolute left-6 top-5 hidden gap-5 text-xs font-medium text-white/75 lg:left-14 lg:top-8 lg:flex">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4" /> GI-verified sellers</span>
            <span className="inline-flex items-center gap-1.5"><Scale className="size-4" /> Bulk pricing</span>
            <span className="inline-flex items-center gap-1.5"><Truck className="size-4" /> UPI or cash on delivery</span>
          </div>

          {/* Bottom navigation: named tabs with progress on desktop, dots on phones */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/35 to-transparent px-6 pb-5 pt-10 sm:px-10 lg:px-14">
            <div className="flex items-end justify-between gap-4">
              <div className="hidden flex-1 gap-2 lg:flex">
                {SLIDES.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`flex-1 text-left text-xs font-semibold transition ${i === index ? 'text-white' : 'text-white/55 hover:text-white/85'}`}
                    aria-label={`Show slide ${i + 1}: ${s.title}`}
                    aria-current={i === index}
                  >
                    <span className="mb-2 block h-[3px] overflow-hidden rounded-full bg-white/25">
                      {i === index && <span key={`${index}-${running}`} className="block h-full rounded-full bg-white" style={progress()} />}
                    </span>
                    {s.tab}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 lg:hidden">
                {SLIDES.map((s, i) => (
                  <button key={s.title} type="button" onClick={() => setIndex(i)} className="relative h-1.5 overflow-hidden rounded-full bg-white/30 transition-all" style={{ width: i === index ? 32 : 10 }} aria-label={`Show slide ${i + 1}: ${s.title}`} aria-current={i === index}>
                    {i === index && <span key={`${index}-${running}`} className="absolute inset-y-0 left-0 rounded-full bg-white" style={progress()} />}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => setStopped(!stopped)} className="grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25" aria-label={stopped ? 'Play slideshow' : 'Pause slideshow'}>
                  {stopped ? <Play className="size-4" /> : <Pause className="size-4" />}
                </button>
                <button type="button" onClick={() => go(-1)} className="grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25" aria-label="Previous slide"><ChevronLeft className="size-5" /></button>
                <button type="button" onClick={() => go(1)} className="grid size-9 place-items-center rounded-full bg-white text-ink transition hover:scale-105" aria-label="Next slide"><ChevronRight className="size-5" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
