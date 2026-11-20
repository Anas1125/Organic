import { Copy, Percent, Search, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { HistoryTable, LinesTable, PayoutDetailsView, balanceText } from '../../components/payouts'
import { Button, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Spinner } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { money } from '../../lib/format'

function CommissionCard({ value, onSaved }) {
  const toast = useToast()
  const [pct, setPct] = useState(String(Number(value)))
  const [busy, setBusy] = useState(false)
  useEffect(() => { setPct(String(Number(value))) }, [value])

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.put('/admin/payouts-commission', { commission_percent: pct || '0' })
      onSaved(data.commission_percent)
      toast.success('Default commission saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="card flex flex-wrap items-end gap-4 p-5 sm:p-6">
      <div className="min-w-60 flex-1">
        <h2 className="flex items-center gap-2 font-semibold"><Percent className="size-4 text-brand-700" /> Default commission</h2>
        <p className="mt-0.5 text-sm text-muted">Pre-filled in the commission box when you approve an enquiry — you can change it for each order there. The seller sees the rate on their offer and must accept it. Orders already approved keep their agreed rate.</p>
      </div>
      <Field label="Default %" className="w-32">
        <Input type="number" min="0" max="50" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} required />
      </Field>
      <Button type="submit" loading={busy}>Save</Button>
    </form>
  )
}

/** Where buyers pay on delivery: shown on their order page with a QR code. */
function PaymentDetailsCard() {
  const toast = useToast()
  const { data, loading } = useFetch('/admin/payment-details')
  const [form, setForm] = useState({ payment_upi: '', payment_payee: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (data) setForm({ payment_upi: data.payment_upi || '', payment_payee: data.payment_payee || '' }) }, [data])

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put('/admin/payment-details', form)
      toast.success('Payment details saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  if (loading) return null
  return (
    <form onSubmit={save} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Wallet className="size-4 text-brand-700" /> Where buyers pay on delivery</h2>
        <p className="mt-0.5 text-sm text-muted">Pay-on-delivery buyers pay you by UPI, not the seller. Their order page shows this UPI ID with a QR code for the exact amount. Then you pay each seller their share here.</p>
        {!form.payment_upi && <p className="mt-2 text-sm font-medium text-amber-700">No UPI ID yet — buyers are told your team will contact them.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Your UPI ID"><Input value={form.payment_upi} onChange={(e) => setForm({ ...form, payment_upi: e.target.value })} placeholder="business@okhdfc" /></Field>
        <Field label="Name shown to buyers"><Input value={form.payment_payee} maxLength={100} onChange={(e) => setForm({ ...form, payment_payee: e.target.value })} placeholder="Terra Mart" /></Field>
        <Button type="submit" loading={busy}>Save</Button>
      </div>
    </form>
  )
}

function SettleDialog({ sellerId, onClose, onDone }) {
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(sellerId ? `/admin/payouts/${sellerId}` : null)
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setReference(''); setNote('') }, [sellerId])

  const b = Number(data?.balance || 0)
  const settle = async () => {
    const what = b >= 0 ? `you have paid ${money(b)} to this seller` : `you have received ${money(-b)} from this seller`
    if (!window.confirm(`Confirm ${what}? The seller will be emailed.`)) return
    setBusy(true)
    try {
      await api.post(`/admin/payouts/${sellerId}`, { amount: data.balance, reference, note })
      toast.success(b >= 0 ? 'Payout recorded' : 'Payment recorded')
      onDone()
    } catch (err) {
      toast.error(errorMessage(err))
      reload()
    } finally {
      setBusy(false)
    }
  }
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'))
  if (!sellerId) return null

  return (
    <Modal open={!!sellerId} onClose={onClose} wide title="Settle with seller"
      footer={data?.lines.length ? (
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button loading={busy} onClick={settle}>{b >= 0 ? `Mark ${money(b)} as paid` : `Mark ${money(-b)} as received`}</Button>
        </>
      ) : null}
    >
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading || !data ? <Spinner /> : (
        <div className="space-y-5">
          <div className={`rounded-2xl p-4 ${b < 0 ? 'bg-amber-50' : 'bg-brand-50'}`}>
            <div className="text-xs font-medium text-muted">{b > 0 ? 'Send this seller' : b < 0 ? 'This seller owes the marketplace' : 'Balance'}</div>
            <div className="mt-0.5 flex items-center gap-2 text-2xl font-bold">
              {money(Math.abs(b))}
              {b !== 0 && <button type="button" onClick={() => copy(String(Math.abs(b)))} className="rounded-full p-1.5 text-muted hover:bg-white" aria-label="Copy amount"><Copy className="size-4" /></button>}
            </div>
            {b < 0 && <p className="mt-1 text-sm text-amber-800">Commission on cash-on-delivery orders. Ask the seller to pay it to you, then record it here.</p>}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Seller's payout details</h3>
            <PayoutDetailsView details={data.details} />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Orders included</h3>
            <LinesTable lines={data.lines} />
          </div>
          {data.lines.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Transaction reference (optional)" hint="UPI reference or bank UTR, so the seller can match it">
                <Input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
              </Field>
              <Field label="Note (optional)"><Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
            </div>
          )}
          {data.lines.length > 0 && (
            <p className="text-xs text-muted">{b >= 0 ? 'Send the money from your bank or UPI app first; this page only records it.' : 'Record it once the money is in your account.'}</p>
          )}
          {data.history.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Earlier payouts</h3>
              <HistoryTable history={data.history} />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function AdminPayouts() {
  const { data, setData, loading, error, reload } = useFetch('/admin/payouts')
  const [open, setOpen] = useState(null)
  const [q, setQ] = useState('')
  if (loading && !data) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const due = data.sellers.filter((r) => r.order_count > 0)
  const toPay = due.reduce((t, r) => t + Math.max(0, Number(r.balance)), 0)
  const toCollect = due.reduce((t, r) => t + Math.max(0, -Number(r.balance)), 0)
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = data.sellers.filter((r) => {
    const text = [r.business_name, r.email, r.phone, r.details.payout_upi, r.details.bank_account_name].join(' ').toLowerCase()
    return words.every((w) => text.includes(w))
  })

  return (
    <>
      <PageHeader title="Seller payouts" subtitle="Buyers pay you (online, or by UPI on delivery). After an order is delivered and paid, pay the seller their share here. Older cash orders the seller collected show the commission to collect." />
      <CommissionCard value={data.commission_percent} onSaved={(commission_percent) => setData({ ...data, commission_percent })} />
      <div className="mt-4"><PaymentDetailsCard /></div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="card p-5"><div className="text-xs font-medium text-muted">To pay sellers</div><div className="mt-0.5 text-2xl font-bold text-brand-800">{money(toPay)}</div></div>
        <div className="card p-5"><div className="text-xs font-medium text-muted">To collect from sellers</div><div className="mt-0.5 text-2xl font-bold text-amber-700">{money(toCollect)}</div></div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">Sellers{words.length > 0 && <span className="ml-2 text-sm font-normal text-muted">{shown.length} of {data.sellers.length}</span>}</h2>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input type="search" className="input pl-9" placeholder="Search seller, email, phone or UPI" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sellers" />
          </div>
        </div>
        {!data.sellers.length ? <EmptyState icon={Wallet} title="No sellers yet" /> : !shown.length ? <EmptyState icon={Search} title={`No sellers match “${q.trim()}”`} /> : (
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.seller_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.business_name}</div>
                  <div className="truncate text-xs text-muted">
                    {r.details.payout_upi || (r.details.bank_account_number ? `Bank · ${r.details.bank_ifsc}` : <span className="text-amber-700">No payout details yet</span>)}
                    {r.order_count > 0 && ` · ${r.order_count} order${r.order_count > 1 ? 's' : ''}`}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${Number(r.balance) < 0 ? 'text-amber-700' : Number(r.balance) > 0 ? 'text-brand-800' : 'text-muted'}`}>{balanceText(r.balance, 'admin')}</div>
                <Button size="sm" variant={r.order_count ? 'primary' : 'outline'} onClick={() => setOpen(r.seller_id)}>{r.order_count ? 'Settle' : 'View'}</Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card mt-6 p-5 sm:p-6">
        <h2 className="mb-2 font-semibold">Recent payouts</h2>
        <HistoryTable history={data.history} showSeller />
      </div>

      <SettleDialog sellerId={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload() }} />
    </>
  )
}
