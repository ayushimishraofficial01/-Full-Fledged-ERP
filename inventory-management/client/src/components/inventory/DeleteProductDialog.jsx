import { useState } from 'react';
import { ConfirmDialog } from '../ui';
import { productService } from '../../services';
import { parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatQty } from '../../utils/format';

export default function DeleteProductDialog({ product, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (!product) return null;
  const hasStock = Number(product.totalStock) > 0;

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await productService.remove(product._id);
      toast.success(res.message);
      onDone?.(res);
      onClose();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={hasStock ? onClose : confirm}
      loading={busy}
      title={hasStock ? 'Product still has stock' : `Delete ${product.name}?`}
      confirmLabel={hasStock ? 'OK' : 'Delete Product'}
      tone={hasStock ? 'info' : 'danger'}
      message={
        hasStock
          ? `${product.name} has ${formatQty(product.totalStock)} ${product.stockUnit} in stock. Stock out or transfer all of it before deleting, so no inventory disappears silently.`
          : 'If this product has any stock history it will be archived (history is kept and it can be restored). Otherwise it will be permanently deleted.'
      }
    />
  );
}
