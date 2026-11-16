import api, { errorMessage } from '../api/client'

let scriptPromise = null

/** Razorpay's checkout script, loaded once when it's first needed. */
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      s.onload = resolve
      s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the payment window. Check your connection and try again.')) }
      document.body.appendChild(s)
    })
  }
  return scriptPromise
}

/**
 * Open Razorpay for an unpaid checkout and resolve with what happened:
 *   { result: 'paid' } | { result: 'closed', failed?: reason }
 * UPI is listed first; cards, netbanking and wallets are also offered.
 */
export async function payOnline(checkoutRef, siteName = 'Terralens') {
  const [{ data: p }] = await Promise.all([api.post(`/payments/checkout/${checkoutRef}/start`), loadRazorpay()])
  return new Promise((resolve, reject) => {
    let lastFailure = null
    const rzp = new window.Razorpay({
      key: p.key_id,
      order_id: p.razorpay_order_id,
      amount: p.amount,
      currency: p.currency,
      name: siteName,
      description: p.order_numbers.length > 1 ? `${p.order_numbers.length} orders` : `Order ${p.order_numbers[0]}`,
      prefill: { name: p.name, email: p.email, contact: p.contact },
      theme: { color: '#1E4D3B' },
      config: { display: { preferences: { show_default_blocks: true }, sequence: ['block.upi'], blocks: { upi: { name: 'Pay using UPI', instruments: [{ method: 'upi' }] } } } },
      handler: async (resp) => {
        try {
          await api.post('/payments/verify', resp)
          resolve({ result: 'paid' })
        } catch (err) {
          // The webhook will still catch a real payment; tell the buyer to check their orders.
          reject(new Error(`${errorMessage(err)} If money was taken, your order will update within a few minutes.`))
        }
      },
      modal: {
        ondismiss: () => resolve({ result: 'closed', failed: lastFailure }),
        confirm_close: true,
      },
    })
    rzp.on('payment.failed', (resp) => {
      lastFailure = resp.error?.description || 'Payment failed'
      api.post('/payments/failed', { razorpay_order_id: p.razorpay_order_id, reason: lastFailure }).catch(() => {})
    })
    rzp.open()
  })
}
