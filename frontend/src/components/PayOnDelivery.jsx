import { CheckCircle2, Copy, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../api/client'
import { useToast } from '../context/ToastContext'
import { money } from '../lib/format'
import { Button, Field, Input } from './ui'

const PAY_STAGES = ['confirmed', 'packed', 'shipped', 'delivered']

/** Does this order still need the buyer to pay the marketplace on delivery? */
export const needsDeliveryPayment = (o) =>
  o.payment_method === 'cod' && o.pay_to_marketplace && o.payment_status === 'pending' && PAY_STAGES.includes(o.status)

/**
 * Pay on delivery: the buyer pays the marketplace by UPI (not the seller or the delivery
 * person). Shows the UPI ID, a QR code with the exact amount, a button that opens the
 * UPI app on phones, and a box to send us the UPI reference.
 */
export default function PayOnDelivery({ order, onChange }) {
  const toast = useToast()
  const [qr, setQr] = useState('')
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const amount = Number(order.total).toFixed(2)
  const upi = order.pay_upi
    ? `upi://pay?${new URLSearchParams({ pa: order.pay_upi, pn: order.pay_payee || '', am: amount, cu: 'INR', tn: `Order ${order.order_number}` })}`
    : ''

  useEffect(() => {
    if (!upi) return
    QRCode.toDataURL(upi, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(''))
  }, [upi])

  const send = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      onChange((await api.post(`/orders/${order.id}/paid`, { reference: ref.trim() || null })).data)
      toast.success("Thanks! We'll confirm your payment shortly")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (order.cod_claimed_at) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div><strong>Thanks — we're checking your payment.</strong>{order.cod_reference ? ` Reference ${order.cod_reference}.` : ''} You'll get an email once it's confirmed.</div>
      </div>
    )
  }

  const arrived = order.status === 'delivered'
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:p-5">
      <h2 className="text-base font-semibold">{arrived ? `Please pay ${money(order.total)}` : `Pay ${money(order.total)} when your order arrives`}</h2>
      <p className="mt-0.5 text-amber-900/80">Pay the marketplace by UPI — <strong>not the seller or the delivery person</strong>.</p>
      {order.pay_upi ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          {qr && <img src={qr} alt={`UPI QR code to pay ${money(order.total)}`} className="size-40 shrink-0 self-center rounded-xl bg-white p-2 sm:self-start" />}
          <div className="min-w-0 flex-1 space-y-3">
            <dl className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-2"><dt className="text-amber-900/70">UPI ID</dt>
                <dd className="flex items-center gap-1 font-mono font-semibold break-all">{order.pay_upi}
                  <button type="button" onClick={() => navigator.clipboard?.writeText(order.pay_upi).then(() => toast.success('UPI ID copied'))} className="rounded-full p-1 hover:bg-amber-100" aria-label="Copy UPI ID"><Copy className="size-3.5" /></button>
                </dd>
              </div>
              {order.pay_payee && <div className="flex gap-2"><dt className="text-amber-900/70">Name</dt><dd className="font-semibold">{order.pay_payee}</dd></div>}
              <div className="flex gap-2"><dt className="text-amber-900/70">Amount</dt><dd className="font-semibold">{money(order.total)}</dd></div>
              <div className="flex gap-2"><dt className="text-amber-900/70">Note</dt><dd className="font-mono">Order {order.order_number}</dd></div>
            </dl>
            <a href={upi} className="inline-flex items-center gap-2 rounded-full bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-950 sm:hidden"><Smartphone className="size-4" /> Pay with a UPI app</a>
            <p className="hidden text-xs text-amber-900/70 sm:block">Scan the QR code with GPay, PhonePe, Paytm or any UPI app.</p>
          </div>
        </div>
      ) : (
        <p className="mt-3">Our team will contact you with the payment details.</p>
      )}
      <form onSubmit={send} className="mt-4 flex flex-col gap-2 border-t border-amber-200 pt-4 sm:flex-row sm:items-end">
        <Field label="Paid? Tap I've paid" hint="UPI reference is optional — the order number is already in the payment note" className="flex-1">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} placeholder="UPI reference (optional)" />
        </Field>
        <Button type="submit" loading={busy}>I've paid</Button>
      </form>
    </div>
  )
}
