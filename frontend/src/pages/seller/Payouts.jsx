import { Banknote, Clock, Percent, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { HistoryTable, LinesTable } from '../../components/payouts'
import { money } from '../../lib/format'
import { Button, ErrorBox, Field, Input, PageHeader, Spinner, StatCard } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'

const EMPTY = { payout_upi: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '' }

function DetailsForm({ details, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, details?.[k] || '']))) }, [details])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      onSaved((await api.put('/seller/payout-details', form)).data)
      toast.success('Payout details saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">Where should we send your money?</h2>
        <p className="mt-0.5 text-sm text-muted">Add a UPI ID, a bank account, or both. Only the marketplace admins can see these.</p>
      </div>
      <Field label="UPI ID" hint="For example yourname@okaxis">
        <Input value={form.payout_upi} onChange={set('payout_upi')} placeholder="name@bank" autoComplete="off" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Account holder name"><Input value={form.bank_account_name} onChange={set('bank_account_name')} autoComplete="off" /></Field>
        <Field label="Account number"><Input inputMode="numeric" pattern="\d{9,18}" title="9 to 18 digits" value={form.bank_account_number} onChange={set('bank_account_number')} autoComplete="off" /></Field>
        <Field label="IFSC"><Input value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value.toUpperCase() })} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" title="11 characters, like SBIN0001234" autoComplete="off" /></Field>
      </div>
      <Button type="submit" loading={busy}>Save payout details</Button>
    </form>
  )
}

export default function Payouts() {
  const { data, setData, loading, error, reload } = useFetch('/seller/payouts')
  if (loading && !data) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const b = Number(data.balance)
  const paidOut = data.history.filter((p) => Number(p.amount) > 0).reduce((t, p) => t + Number(p.amount), 0)

  return (
    <>
      <PageHeader title="Payouts" subtitle="Your earnings from delivered orders, and the payments the marketplace has made to you." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={b < 0 ? 'You owe (commission)' : 'To be paid to you'} value={money(Math.abs(b))} icon={Wallet} tone={b < 0 ? 'amber' : 'brand'} />
        <StatCard label="Orders waiting" value={data.lines.length} icon={Clock} tone="sky" />
        <StatCard label="Paid to you so far" value={money(paidOut)} icon={Banknote} tone="violet" />
        <StatCard label="Usual commission" value={`${Number(data.commission_percent)}%`} icon={Percent} tone="amber" />
      </div>

      <div className="card mt-6 p-5 text-sm leading-relaxed text-ink/80 sm:p-6">
        <h2 className="mb-2 text-base font-semibold text-ink">How payouts work</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Buyers pay the marketplace</strong>: online, or by UPI on delivery. Please don't collect money from buyers.</li>
          <li>Once an order is delivered and the marketplace has received the money, you are paid the order total minus the commission you accepted.</li>
          <li>Older cash-on-delivery orders you collected yourself: the commission is taken off your next payout.</li>
          <li>If an order is refunded after it was paid out, that amount is taken off your next payout.</li>
          <li>You'll get an email each time a payout is sent.</li>
        </ul>
      </div>

      <div className="mt-6"><DetailsForm details={data.details} onSaved={(details) => setData({ ...data, details })} /></div>

      <div className="card mt-6 p-5 sm:p-6">
        <h2 className="mb-2 font-semibold">Orders in your next payout</h2>
        <LinesTable lines={data.lines} />
      </div>
      <div className="card mt-6 p-5 sm:p-6">
        <h2 className="mb-2 font-semibold">Payout history</h2>
        <HistoryTable history={data.history} />
      </div>
    </>
  )
}
