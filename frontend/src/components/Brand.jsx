import { Apple, Carrot, CookingPot, Droplet, Fish, Flame, Flower2, Lamp, Leaf, MapPin, Palette, Shirt, Sprout, Wheat } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSite } from '../context/SiteContext'

export function LeafMark({ light = false, className = 'size-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M5 26C5 13 13 5 28 4c-1 15-9 23-22 23l-1-1z" fill={light ? '#c9dfc6' : '#1e4d3b'} />
      <path d="M7 25c5-7 11-11 17-15" stroke={light ? '#163a2c' : '#a3c79f'} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Brand logo. Uses the uploaded logo and name from Admin → Site settings when set. */
export function Logo({ light = false, className = '', asLink = true }) {
  const { site } = useSite()
  const body = (
    <>
      {site.logo_url
        ? <img src={site.logo_url} alt="" className="h-8 w-auto max-w-[120px] object-contain" />
        : <LeafMark light={light} />}
      <span className={`max-w-[180px] truncate text-xl font-bold tracking-tight sm:max-w-[240px] ${light ? 'text-white' : 'text-brand-800'}`}>{site.site_name}</span>
    </>
  )
  if (!asLink) return <span className={`flex min-w-0 items-center gap-2 ${className}`}>{body}</span>
  return (
    <Link to="/" className={`flex min-w-0 shrink-0 items-center gap-2 ${className}`} aria-label={`${site.site_name} home`}>
      {body}
    </Link>
  )
}

/** Icon + soft tint per category, used for category chips and image placeholders. */
const CATEGORY_LOOK = {
  'rice-grains': { icon: Wheat, bg: '#f6efd9', fg: '#a37b1c' },
  millets: { icon: Sprout, bg: '#efeadb', fg: '#8a6a2d' },
  vegetables: { icon: Carrot, bg: '#e4f1df', fg: '#3b7049' },
  fruits: { icon: Apple, bg: '#fde6e1', fg: '#c2412d' },
  'dried-fish': { icon: Fish, bg: '#e1edf5', fg: '#2f6c94' },
  spices: { icon: Flame, bg: '#fbe6d6', fg: '#c25a1c' },
  'oils-ghee': { icon: Droplet, bg: '#fbf1cf', fg: '#a07a0c' },
  'homemade-foods': { icon: CookingPot, bg: '#f4e4ee', fg: '#9b3d76' },
  'regional-specialties': { icon: MapPin, bg: '#e7e8f7', fg: '#4b4fa8' },
  'sarees-handlooms': { icon: Shirt, bg: '#fbe3e1', fg: '#a8322b' },
  handicrafts: { icon: Palette, bg: '#f3e7d6', fg: '#8a5a1f' },
  'home-kitchen': { icon: Lamp, bg: '#e3eef0', fg: '#2f6670' },
  flowers: { icon: Flower2, bg: '#fbe6f1', fg: '#b03c7a' },
}
const DEFAULT_LOOK = { icon: Leaf, bg: '#e4efe2', fg: '#2c5a3e' }

export const categoryLook = (slug) => CATEGORY_LOOK[slug] || DEFAULT_LOOK

export function CategoryIcon({ slug, className = 'size-6' }) {
  const { icon: Icon, fg } = categoryLook(slug)
  return <Icon className={className} style={{ color: fg }} strokeWidth={1.8} />
}
