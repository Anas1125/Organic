import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Leaf, MapPin, Scale, ShieldCheck, Store, Truck } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import HeroCarousel from '../../components/HeroCarousel'
import { CategoryIcon, categoryLook } from '../../components/Brand'
import { ProductCard, ProductCardSkeleton } from '../../components/product'
import { Button, ErrorBox } from '../../components/ui'
import useFetch from '../../hooks/useFetch'
import { useSite } from '../../context/SiteContext'

/** Horizontal row with arrow buttons (wheel / swipe also scroll it). */
function ScrollRow({ children, label }) {
  const ref = useRef(null)
  const by = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' })
  return (
    <div className="group/row relative">
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0" aria-label={label}>
        {children}
      </div>
      <button type="button" onClick={() => by(-1)} className="absolute -left-4 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-lift transition hover:scale-105 md:grid" aria-label="Scroll left"><ChevronLeft className="size-5" /></button>
      <button type="button" onClick={() => by(1)} className="absolute -right-4 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-lift transition hover:scale-105 md:grid" aria-label="Scroll right"><ChevronRight className="size-5" /></button>
    </div>
  )
}

function SectionHead({ eyebrow, title, to, link = 'See all' }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</div>}
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      </div>
      {to && <Link to={to} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">{link} <ArrowRight className="size-4" /></Link>}
    </div>
  )
}

function Categories() {
  const { data: all } = useFetch('/categories')
  const data = all?.filter((c) => c.product_count > 0).sort((a, b) => b.product_count - a.product_count)
  if (!data?.length) return null
  // Mosaic: the biggest category gets a large 2×2 tile. Then just enough of the next
  // tiles are made double-width that every row is full (2, 4 and 6 columns).
  const cells = 4 + (data.length - 1)
  const extra = (cols) => (cols - (cells % cols)) % cols
  const [x2, x4, x6] = [extra(2), extra(4), extra(6)]
  const size = (i) => i === 0
    ? 'col-span-2 row-span-2'
    : [i <= x2 ? 'col-span-2' : 'col-span-1', i <= x4 ? 'sm:col-span-2' : 'sm:col-span-1', i <= x6 ? 'lg:col-span-2' : 'lg:col-span-1'].join(' ')
  return (
    <section className="container-page mt-14">
      <SectionHead eyebrow="Browse" title="Shop by category" to="/shop" />
      <div className="grid grid-flow-dense auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[170px] sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
        {data.map((c, i) => (
          <Link key={c.id} to={`/shop?category=${c.slug}`} className={`group relative overflow-hidden rounded-3xl ${size(i)}`} style={{ background: categoryLook(c.slug).bg }}>
            {c.image
              ? <img src={c.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              : <span className="absolute inset-0 grid place-items-center"><CategoryIcon slug={c.slug} className="size-12" /></span>}
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white">
              <span>
                <span className={`block font-bold leading-tight ${i === 0 ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'}`}>{c.name}</span>
                <span className="text-xs text-white/80">{c.product_count} product{c.product_count === 1 ? '' : 's'}</span>
              </span>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur transition group-hover:bg-white group-hover:text-ink"><ArrowRight className="size-4" /></span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Districts() {
  const { data } = useFetch('/products/districts')
  if (!data?.length) return null
  const list = [...data].sort((a, b) => b.product_count - a.product_count)
  return (
    <section className="container-page mt-16">
      <SectionHead eyebrow="Every GI tag belongs to a place" title="Shop by district" to="/shop" link="All districts" />
      <ScrollRow label="Districts">
        {list.map((d) => (
          <Link key={d.name} to={`/shop?district=${encodeURIComponent(d.name)}`} className="group relative h-64 w-44 shrink-0 snap-start overflow-hidden rounded-3xl bg-brand-900 sm:w-52">
            {d.image && <img src={d.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-brand-800"><MapPin className="size-3" /> Tamil Nadu</span>
            <span className="absolute inset-x-0 bottom-0 p-4 text-white">
              <span className="block text-lg font-bold leading-tight">{d.name}</span>
              <span className="text-xs text-white/80">{d.product_count} GI product{d.product_count === 1 ? '' : 's'}</span>
            </span>
          </Link>
        ))}
      </ScrollRow>
    </section>
  )
}

function Popular() {
  const { site } = useSite()
  const { data, loading, error, reload } = useFetch('/products', { page_size: 12 })
  return (
    <section className="container-page mt-16">
      <SectionHead eyebrow="Just listed" title={`New on ${site.site_name}`} to="/shop" />
      {error ? <ErrorBox message={error} onRetry={reload} />
        : loading ? <ProductCardSkeleton count={4} />
        : data.items.length ? (
          <ScrollRow label="New products">
            {data.items.map((p) => <div key={p.id} className="flex w-[210px] shrink-0 snap-start sm:w-[260px]"><ProductCard product={p} /></div>)}
          </ScrollRow>
        )
        : <p className="card p-8 text-center text-sm text-muted">Products will appear here once sellers list them.</p>}
    </section>
  )
}

function Trust() {
  const items = [
    { icon: Leaf, title: 'Verified organic', text: 'The Organic badge only appears after we check a valid certificate.' },
    { icon: BadgeCheck, title: 'GI-tagged heritage', text: 'Geographical Indication details are reviewed before they are shown.' },
    { icon: Scale, title: 'Bulk pricing', text: 'Prices drop automatically as your quantity goes up.' },
    { icon: Truck, title: 'UPI or cash on delivery', text: 'Pay securely online, or when your order reaches you.' },
  ]
  return (
    <section className="container-page mt-14">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-5">
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon className="size-5" /></div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function SellerCTA() {
  return (
    <section className="container-page mt-14">
      <div className="flex flex-col items-start gap-6 overflow-hidden rounded-[28px] bg-brand-800 p-8 text-white sm:p-10 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="mb-3 grid size-11 place-items-center rounded-xl bg-white/10"><Store className="size-5" /></div>
          <h2 className="text-2xl font-bold sm:text-3xl">Grow it, make it, sell it here</h2>
          <p className="mt-2 text-brand-100/80">GI producers, weavers and artisans reach shops, hotels and exporters across India — with wholesale pricing built in.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button to="/register?role=seller" size="lg" variant="secondary">Become a seller <ArrowRight className="size-5" /></Button>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
        <ShieldCheck className="size-4" /> Every seller is reviewed before they can list products.
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <HeroCarousel />
      <Categories />
      <Districts />
      <Popular />
      <Trust />
      <SellerCTA />
    </>
  )
}
