import { forwardRef } from 'react';
import { Select } from './Field';
import { useMeta } from '../../context/MetaContext';

/** Warehouse dropdown fed by the cached warehouse list. */
const WarehouseSelect = forwardRef(function WarehouseSelect({ value, onChange, placeholder = 'Select warehouse', activeOnly = false, exclude, error, id, className }, ref) {
  const { warehouses, activeWarehouses } = useMeta();
  const list = (activeOnly ? activeWarehouses : warehouses).filter((w) => w._id !== exclude);
  return (
    <Select ref={ref} id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} error={error} placeholder={placeholder} className={className}>
      {list.map((w) => (
        <option key={w._id} value={w._id}>
          {w.name} ({w.code}){w.status !== 'active' ? ' · inactive' : ''}
        </option>
      ))}
    </Select>
  );
});

export default WarehouseSelect;
