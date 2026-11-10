import { useEffect, useState } from 'react'
import { Button, Field, Modal, Textarea } from '../../components/ui'

/** Asks for a reason/note, then calls onSubmit(text). Used when rejecting things. */
export default function ReviewDialog({ open, title, label = 'Reason', required = true, onClose, onSubmit, confirmText = 'Reject', danger = true }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setText('') }, [open])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await onSubmit(text.trim()) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={label} hint="The seller will see this.">
          <Textarea required={required} rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={busy}>{confirmText}</Button>
        </div>
      </form>
    </Modal>
  )
}
