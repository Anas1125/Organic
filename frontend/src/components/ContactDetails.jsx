import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { useSite } from '../context/SiteContext'

const mapsUrl = (place) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`

/** Contact details from Admin → Site settings. Empty fields are not shown. */
export function contactItems(site) {
  const items = []
  if (site.contact_email) items.push({ key: 'email', icon: Mail, text: site.contact_email, href: `mailto:${site.contact_email}` })
  if (site.contact_phone) items.push({ key: 'phone', icon: Phone, text: site.contact_phone, href: `tel:${site.contact_phone.replace(/[^\d+]/g, '')}` })
  if (site.contact_hours) items.push({ key: 'hours', icon: Clock, text: site.contact_hours })
  ;(site.locations || []).forEach((loc, i) => items.push({ key: `loc${i}`, icon: MapPin, text: loc, href: mapsUrl(loc), external: true }))
  return items
}

export default function ContactDetails({ variant = 'page' }) {
  const { site } = useSite()
  const items = contactItems(site)
  if (!items.length) return null
  const footer = variant === 'footer'

  return (
    <ul className={footer ? 'space-y-2.5 text-sm text-brand-200/80' : 'space-y-4 text-sm'}>
      {items.map(({ key, icon: Icon, text, href, external }) => {
        const content = (
          <>
            {footer
              ? <Icon className="mt-0.5 size-4 shrink-0 text-brand-300" />
              : <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon className="size-4" /></span>}
            <span className={`min-w-0 [overflow-wrap:anywhere] ${footer ? '' : 'pt-2.5'}`}>{text}</span>
          </>
        )
        const cls = `flex items-start gap-3 ${href ? (footer ? 'hover:text-white' : 'hover:text-brand-700') : ''}`
        return (
          <li key={key}>
            {href
              ? <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{content}</a>
              : <div className={cls}>{content}</div>}
          </li>
        )
      })}
    </ul>
  )
}
