import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Delete', tone = 'danger' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      icon={AlertTriangle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
    </Modal>
  )
}
