import {
  ArrowRight, BadgeCheck, HandHeart, Leaf, MessageCircle, Package, Scale, ShieldCheck, ShoppingBasket,
  Sprout, Store, Truck,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { CategoryIcon, categoryLook } from '../../components/Brand'
import ContactDetails, { contactItems } from '../../components/ContactDetails'
import { Button, Field, Input, Textarea } from '../../components/ui'
import { useSite } from '../../context/SiteContext'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'

function Steps({ icon: Icon, title, steps }) {
  return (
    <div className="card p-6 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon className="size-5" /></span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <ol className="space-y-4">
        {steps.map(([head, text], i) => (
          <li key={head} className="flex gap-4">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-800 text-xs font-bold text-white">{i + 1}</span>
            <div>
              <div className="text-sm font-semibold">{head}</div>
              <div className="text-sm text-muted">{text}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function About() {
  const { site } = useSite()
  const { data: categories } = useFetch('/categories')
  const { data: products } = useFetch('/products', { page_size: 1 })
  const name = site.site_name

  const stats = [
    { value: products?.total ?? '—', label: 'Products listed' },
    { value: categories?.length ?? '—', label: 'Food categories' },
    { value: '100%', label: 'Badges checked by our team' },
    { value: 'COD', label: 'Pay when it arrives' },
  ]

  const values = [
    { icon: Sprout, title: 'Fair to growers', text: 'Sellers set their own prices and deal with buyers directly — no chain of middlemen taking a cut.' },
    { icon: Leaf, title: 'Honest labels', text: 'Organic and GI badges appear only after we check the certificate or registration behind them.' },
    { icon: HandHeart, title: 'Traditions kept alive', text: 'Heritage rice, millets, karuvadu, podis and pickles made the way families always have.' },
    { icon: Scale, title: 'Built for bulk too', text: 'Prices drop automatically at higher quantities, so shops and kitchens can buy direct.' },
  ]

  return (
    <div className="container-page py-10 sm:py-14">
      {/* Intro */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">About {name}</div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-brand-900 sm:text-5xl">
            Connecting India’s farmers and food makers with people who care what they eat.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            {name} is a marketplace only for organic and traditional food. Farmers, fishing collectives and small producers list their products; households and wholesale buyers order directly from them — in single packets or in bulk.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button to="/shop" size="lg">Explore the shop <ArrowRight className="size-5" /></Button>
            <Button to="/register?role=seller" size="lg" variant="outline">Become a seller</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`rounded-3xl p-5 sm:p-6 ${i === 0 ? 'bg-brand-800 text-white' : 'card'}`}>
              <div className={`text-3xl font-extrabold sm:text-4xl ${i === 0 ? '' : 'text-brand-800'}`}>{s.value}</div>
              <div className={`mt-1 text-sm ${i === 0 ? 'text-brand-100/80' : 'text-muted'}`}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="mt-16 grid gap-8 rounded-[28px] bg-brand-100 p-6 sm:p-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Why we started</div>
          <h2 className="mt-3 text-2xl font-bold text-brand-900 sm:text-3xl">Good food shouldn’t be hard to find — or hard to trust.</h2>
        </div>
        <div className="space-y-4 leading-relaxed text-brand-900/80">
          <p>
            The people growing heritage rice in the delta or sun-drying karuvadu on the coast rarely get a fair price. By the time their food reaches a city shelf, it has passed through several hands — and often lost its story, and sometimes its “organic” label is just a sticker.
          </p>
          <p>
            We built {name} to shorten that chain. Sellers list directly, buyers see exactly who made their food and where, and every certification claim is checked by a person before it ever shows up as a badge.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold sm:text-3xl">What we stand for</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-6">
              <div className="mb-4 grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon className="size-5" /></div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What you'll find */}
      {categories?.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-bold sm:text-3xl">What you’ll find</h2>
            <Link to="/shop" className="flex items-center gap-1 text-sm font-semibold text-brand-700">Browse everything <ArrowRight className="size-4" /></Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c) => (
              <Link key={c.id} to={`/shop?category=${c.slug}`} className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
                <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ background: categoryLook(c.slug).bg }}>
                  <CategoryIcon slug={c.slug} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-muted">{c.product_count} product{c.product_count === 1 ? '' : 's'}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Steps icon={ShoppingBasket} title="For buyers" steps={[
            ['Browse and compare', 'Search by product, region or seller. Filter for certified organic, GI-tagged or bulk deals.'],
            ['Order any quantity', 'Bulk prices apply automatically. A cart with several sellers becomes one order per seller.'],
            ['Pay on delivery', 'Track each order from confirmed to delivered, and pay in cash when it arrives.'],
          ]} />
          <Steps icon={Store} title="For sellers" steps={[
            ['Register your business', 'Tell us about your farm, collective or kitchen. Our team reviews every new seller.'],
            ['Upload certificates', 'Add organic certificates and GI details. We verify them before any badge appears.'],
            ['List your products', 'Set your own prices, minimum orders and bulk tiers. Listings go live after a quick review.'],
            ['Fulfil and grow', 'Confirm, pack and ship orders from your dashboard and watch your sales grow.'],
          ]} />
        </div>
      </section>

      {/* Verification */}
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="grid size-12 place-items-center rounded-2xl bg-brand-800 text-white"><ShieldCheck className="size-6" /></div>
          <h2 className="mt-4 text-2xl font-bold sm:text-3xl">How we verify</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">Uploading a document never adds a badge on its own. A person on our team checks it first.</p>
        </div>
        <div className="card p-6">
          <Leaf className="size-6 text-brand-700" />
          <h3 className="mt-3 font-semibold">Organic badge</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">Sellers upload their NPOP, PGS-India or other organic certificate. We check the number, issuing body and dates. Expired certificates stop showing the badge automatically.</p>
        </div>
        <div className="card p-6">
          <BadgeCheck className="size-6 text-amber-700" />
          <h3 className="mt-3 font-semibold">GI badge</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">Registered GI products and authorised users are verified against their registration details. GI applications are recorded, but the badge only appears once the GI is registered.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 flex flex-col items-start gap-6 rounded-[28px] bg-brand-800 p-8 text-white sm:p-10 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-2xl font-bold sm:text-3xl">Questions, or want to sell with us?</h2>
          <p className="mt-2 text-brand-100/80">We’re happy to help buyers, farmers and food makers get started.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button to="/contact" size="lg" variant="secondary"><MessageCircle className="size-5" /> Contact us</Button>
          <Button to="/shop" size="lg" variant="outline" className="!border-white/30 !bg-transparent !text-white hover:!bg-white/10"><Package className="size-5" /> Start shopping</Button>
        </div>
      </section>
    </div>
  )
}

export function Contact() {
  const { site } = useSite()
  const toast = useToast()
  const empty = { name: '', email: '', subject: '', message: '' }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const hasDetails = contactItems(site).length > 0

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post('/contact', form)
      toast.success(data.detail)
      setForm(empty)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-900 sm:text-4xl">Get in touch</h1>
          <p className="mt-3 text-muted">
            Questions about an order, selling on {site.site_name} or certification? {hasDetails ? 'Reach us directly or send a message.' : 'Send us a message.'} We usually reply within a working day.
          </p>
          {hasDetails && <div className="mt-8"><ContactDetails /></div>}
          <div className="mt-8 rounded-2xl bg-brand-100 p-5 text-sm text-brand-900">
            <div className="flex items-center gap-2 font-semibold"><Truck className="size-4" /> Question about an order?</div>
            <p className="mt-1 text-brand-900/75">Include your order number (it starts with “TL-”) so we can help faster.</p>
          </div>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name"><Input required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" /></Field>
            <Field label="Email"><Input required type="email" value={form.email} onChange={set('email')} autoComplete="email" /></Field>
          </div>
          <Field label="Subject"><Input required minLength={2} value={form.subject} onChange={set('subject')} /></Field>
          <Field label="Message"><Textarea required minLength={10} rows={5} value={form.message} onChange={set('message')} /></Field>
          <Button type="submit" loading={busy} size="lg" className="w-full sm:w-auto">Send message</Button>
        </form>
      </div>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <div className="text-6xl font-extrabold text-brand-200">404</div>
        <h1 className="mt-2 text-xl font-bold">Page not found</h1>
        <p className="mt-1 text-sm text-muted">The page you’re looking for doesn’t exist.</p>
        <Button to="/" className="mt-6">Go home</Button>
      </div>
    </div>
  )
}
