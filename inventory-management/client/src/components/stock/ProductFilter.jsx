import { useEffect, useState } from 'react';
import { ProductPicker } from '../ui';
import { productService } from '../../services';

/** ProductPicker bound to a product id (e.g. from the URL). */
export default function ProductFilter({ productId, onChange }) {
  const [product, setProduct] = useState(null);
  useEffect(() => {
    if (!productId) return setProduct(null);
    if (product?._id === productId) return undefined;
    let active = true;
    productService.get(productId).then((r) => active && setProduct(r.product)).catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);
  return (
    <div className="lg:w-72">
      <ProductPicker value={product} onChange={(p) => { setProduct(p); onChange(p?._id || ''); }} placeholder="Filter by product" />
    </div>
  );
}
