const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

export const money = (v) => inr.format(Number(v || 0)).replace('.00', '')

export const date = (v) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const dateTime = (v) =>
  v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export const titleCase = (s) => (s || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** Same rule as the backend: matching bulk tier, else base price. */
export function unitPriceFor(product, qty) {
  const tier = (product.price_tiers || []).find(
    (t) => qty >= t.min_qty && (t.max_qty == null || qty <= t.max_qty),
  )
  return Number(tier ? tier.unit_price : product.price)
}

export const UNITS = ['kg', 'g', 'litre', 'ml', 'packet', 'piece', 'dozen', 'bundle', 'box']

export const ORDER_STEPS = ['pending', 'confirmed', 'packed', 'shipped', 'delivered']

export const GI_TYPES = {
  registered_product: 'Registered GI product',
  application: 'GI application (not yet registered)',
  authorised_user: 'Authorised user of a registered GI',
}

export const GI_STATUS_LABELS = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
  info_requested: 'More info needed',
}

/** Which number fields each GI record type needs. Mirrors the backend rules. */
export const GI_NUMBER_LABEL = {
  registered_product: 'GI registration number',
  application: 'GI application number',
  authorised_user: 'GI registration number (of the registered GI)',
}
