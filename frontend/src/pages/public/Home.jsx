import { ArrowRight, BadgeCheck, Leaf, Scale, ShieldCheck, Store, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CategoryIcon, categoryLook } from '../../components/Brand'
import { ProductCardSkeleton, ProductGrid } from '../../components/product'
import { Button, ErrorBox } from '../../components/ui'
import useFetch from '../../hooks/useFetch'
import { useSite } from '../../context/SiteContext'

function Hero() {
  const bubbles = ['rice-grains', 'vegetables', 'dried-fish', 'spices', 'fruits', 'millets']
  return (
    <section className="container-page pt-6 sm:pt-10">
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Fresh / Organic / Traditional</div>
          <h1 className="text-[40px] font-extrabold leading-[1.05] text-brand-900 sm:text-6xl">
            Good Food<br />Better <span className="text-brand-600">Choices</span>
          </h1>
          <div className="mt-4 h-1.5 w-20 rounded-full bg-brand-800" />
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            Organic rice, millets, sun-dried karuvadu, spices and homemade foods — straight from the farmers and families who make them.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button to="/shop" size="lg">Shop fresh <ArrowRight className="size-5" /></Button>
            <Button to="/register?role=seller" size="lg" variant="outline">Sell with us</Button>
          </div>
          <p className="mt-8 text-lg italic text-brand-700/80">Real food. Real impact.</p>
        </div>

        <div>
          <div className="flex flex-col gap-6 overflow-hidden rounded-[28px] bg-brand-100 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="flex-1">
              <span className="inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-800">100% Verified sellers</span>
              <h2 className="mt-3 text-2xl font-bold leading-tight text-brand-900 sm:text-3xl">Farm fresh, the traditional way</h2>
              <p className="mt-2 text-sm text-brand-800/70">Straight from local farms and coastal villages to your home.</p>
              <Button to="/shop" size="sm" className="mt-5">Shop now <ArrowRight className="size-4" /></Button>
            </div>
            <div className="grid shrink-0 grid-cols-6 gap-2 sm:w-48 sm:grid-cols-3 sm:gap-3 sm:pb-3">
              {bubbles.map((slug, i) => (
                <div
                  key={slug}
                  className={`grid aspect-square place-items-center rounded-2xl bg-white shadow-card ${i % 2 ? 'sm:translate-y-3' : ''}`}
                  style={{ background: categoryLook(slug).bg }}
                >
                  <CategoryIcon slug={slug} className="size-5 sm:size-7" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Categories() {
  const { data } = useFetch('/categories')
  if (!data?.length) return null
  return (
    <section className="container-page mt-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">Shop by category</h2>
        <Link to="/shop" className="flex items-center gap-1 text-sm font-semibold text-brand-700">See all <ArrowRight className="size-4" /></Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0 lg:grid-cols-9">
        {data.map((c) => (
          <Link key={c.id} to={`/shop?category=${c.slug}`} className="group flex w-20 shrink-0 flex-col items-center gap-2 text-center sm:w-auto">
            <span className="grid size-16 place-items-center rounded-full transition group-hover:scale-105 sm:size-[72px]" style={{ background: categoryLook(c.slug).bg }}>
              <CategoryIcon slug={c.slug} className="size-7" />
            </span>
            <span className="text-xs font-medium leading-tight text-ink/80">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Popular() {
  const { site } = useSite()
  const { data, loading, error, reload } = useFetch('/products', { page_size: 8 })
  return (
    <section className="container-page mt-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">Fresh on {site.site_name}</h2>
        <Link to="/shop" className="flex items-center gap-1 text-sm font-semibold text-brand-700">See all <ArrowRight className="size-4" /></Link>
      </div>
      {error ? <ErrorBox message={error} onRetry={reload} />
        : loading ? <ProductCardSkeleton count={4} />
        : data.items.length ? <ProductGrid products={data.items} />
        : <p className="card p-8 text-center text-sm text-muted">Products will appear here once sellers list them.</p>}
    </section>
  )
}

function Trust() {
  const items = [
    { icon: Leaf, title: 'Verified organic', text: 'The Organic badge only appears after we check a valid certificate.' },
    { icon: BadgeCheck, title: 'GI-tagged heritage', text: 'Geographical Indication details are reviewed before they are shown.' },
    { icon: Scale, title: 'Bulk pricing', text: 'Prices drop automatically as your quantity goes up.' },
    { icon: Truck, title: 'Cash on delivery', text: 'Pay when your order reaches you.' },
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
          <p className="mt-2 text-brand-100/80">Farmers, fishing collectives and home food makers reach buyers across India — individual customers and wholesale shops.</p>
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
      <Hero />
      <Categories />
      <Popular />
      <Trust />
      <SellerCTA />
    </>
  )
}
