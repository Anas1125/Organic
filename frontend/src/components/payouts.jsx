import { money, date } from '../lib/format'

/** Plain-language balance: who pays whom. `side` is 'seller' or 'admin'. */
export function balanceText(balance, side) {
  const b = Number(balance)
  if (!b) return side === 'seller' ? 'All settled' : 'Nothing to settle'
  if (side === 'seller') return b > 0 ? `${money(b)} to be paid to you` : `You owe ${money(-b)} commission`
  return b > 0 ? `Pay ${money(b)}` : `Collect ${money(-b)}`
}

export function PayoutDetailsView({ details }) {
  const d = details || {}
  if (!d.payout_upi && !d.bank_account_number) return <p className="text-sm text-amber-700">No UPI ID or bank account added yet.</p>
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
      {d.payout_upi && <><dt className="text-muted">UPI ID</dt><dd className="font-medium break-all">{d.payout_upi}</dd></>}
      {d.bank_account_number && (
        <>
          <dt className="text-muted">Account holder</dt><dd className="font-medium">{d.bank_account_name}</dd>
          <dt className="text-muted">Account number</dt><dd className="font-mono font-medium">{d.bank_account_number}</dd>
          <dt className="text-muted">IFSC</dt><dd className="font-mono font-medium">{d.bank_ifsc}</dd>
        </>
      )}
    </dl>
  )
}

/** Orders waiting to be settled. */
export function LinesTable({ lines }) {
  if (!lines.length) return <p className="py-4 text-sm text-muted">No delivered orders waiting to be settled.</p>
  return (
    <div className="overflow-x-auto">
      <table className="table-stack w-full text-sm sm:min-w-[560px]">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">Order</th>
            <th className="py-2 pr-3 font-medium">Paid by</th>
            <th className="py-2 pr-3 text-right font-medium">Order total</th>
            <th className="py-2 pr-3 text-right font-medium">Commission</th>
            <th className="py-2 text-right font-medium">To seller</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((ln) => (
            <tr key={`${ln.kind}-${ln.order_id}`} className="border-b border-line/60 last:border-0">
              <td className="py-2.5 pr-3">
                <div className="font-medium">{ln.order_number}</div>
                <div className="text-xs text-muted">{ln.kind === 'reversal' ? 'Refunded after it was paid out' : `Delivered ${date(ln.delivered_at)}`}</div>
              </td>
              <td data-label="Paid by" className="py-2.5 pr-3">{ln.payment_method === 'online' ? 'Online (to marketplace)' : ln.pay_to_marketplace ? 'On delivery (to marketplace)' : 'Cash (to seller)'}</td>
              <td data-label="Order total" className="py-2.5 pr-3 sm:text-right">{money(ln.total)}</td>
              <td data-label="Commission" className="py-2.5 pr-3 text-muted sm:text-right">{ln.kind === 'reversal' ? '—' : `${money(ln.commission)} (${Number(ln.commission_rate)}%)`}</td>
              <td data-label="To seller" className={`py-2.5 font-semibold sm:text-right ${Number(ln.amount) < 0 ? 'text-red-700' : 'text-brand-800'}`}>{money(ln.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function HistoryTable({ history, showSeller }) {
  if (!history.length) return <p className="py-4 text-sm text-muted">No payouts yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="table-stack w-full text-sm sm:min-w-[520px]">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">Date</th>
            {showSeller && <th className="py-2 pr-3 font-medium">Seller</th>}
            <th className="py-2 pr-3 font-medium">Reference</th>
            <th className="py-2 pr-3 text-right font-medium">Orders</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {history.map((p) => (
            <tr key={p.id} className="border-b border-line/60 last:border-0">
              <td className="py-2.5 pr-3 whitespace-nowrap">{date(p.created_at)}</td>
              {showSeller && <td data-label="Seller" className="py-2.5 pr-3">{p.business_name}</td>}
              <td data-label="Reference" className="py-2.5 pr-3"><div className="break-all">{p.reference || '—'}</div>{p.note && <div className="text-xs text-muted">{p.note}</div>}</td>
              <td data-label="Orders" className="py-2.5 pr-3 sm:text-right">{p.order_count}</td>
              <td data-label="Amount" className="py-2.5 font-semibold sm:text-right">
                {Number(p.amount) >= 0 ? <span className="text-brand-800">Paid {money(p.amount)}</span> : <span className="text-amber-700">Received {money(-p.amount)}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
