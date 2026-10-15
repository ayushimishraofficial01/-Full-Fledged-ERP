import { AlertTriangle, Info } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, children, confirmLabel = 'Confirm', tone = 'danger', loading = false }) {
  const Icon = tone === 'danger' ? AlertTriangle : Info;
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      dismissible={!loading}
      size="sm"
      title={
        <span className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone === 'danger' ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : 'bg-brand-50 text-brand-600 ring-1 ring-brand-100'}`}>
            <Icon className="h-5 w-5" />
          </span>
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p className="text-sm leading-relaxed text-slate-600">{message}</p>}
      {children}
    </Modal>
  );
}
