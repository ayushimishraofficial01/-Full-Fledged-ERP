import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inventoryService, productService } from '../../services';

/** Reads ?product=&warehouse= so stock forms can be opened pre-filled from other pages. */
export function useStockPrefill() {
  const [sp] = useSearchParams();
  const [product, setProduct] = useState(null);
  const productId = sp.get('product');
  const warehouseId = sp.get('warehouse') || '';

  useEffect(() => {
    if (!productId) return;
    productService.get(productId).then((r) => setProduct({ ...r.product })).catch(() => {});
  }, [productId]);

  return { product, setProduct, warehouseId };
}

/** Live available quantity of a product in a warehouse. */
export function useAvailable(productId, warehouseId, refreshKey) {
  const [state, setState] = useState({ loading: false, quantity: null, unit: null, status: null });
  useEffect(() => {
    if (!productId || !warehouseId) return setState({ loading: false, quantity: null, unit: null, status: null });
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    inventoryService
      .available(productId, warehouseId)
      .then((r) => active && setState({ loading: false, quantity: r.quantity, unit: r.unit, status: r.status }))
      .catch(() => active && setState({ loading: false, quantity: null, unit: null, status: null }));
    return () => {
      active = false;
    };
  }, [productId, warehouseId, refreshKey]);
  return state;
}
