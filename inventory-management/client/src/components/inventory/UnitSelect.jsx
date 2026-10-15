import { Select } from '../ui';
import { useMeta } from '../../context/MetaContext';

const GROUPS = [
  ['weight', 'Weight'],
  ['volume', 'Volume'],
  ['quantity', 'Quantity'],
  ['length', 'Length'],
  ['other', 'Other'],
];

/** Unit dropdown grouped by Weight / Volume / Quantity; custom units from Settings appear automatically. */
export default function UnitSelect({ value, onChange, error, id, placeholder = 'Select unit', disabled }) {
  const { units } = useMeta();
  const known = units.some((u) => u.name === value);
  return (
    <Select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} error={error} placeholder={placeholder} disabled={disabled}>
      {value && !known && <option value={value}>{value}</option>}
      {GROUPS.map(([key, label]) => {
        const list = units.filter((u) => u.category === key);
        if (!list.length) return null;
        return (
          <optgroup key={key} label={label}>
            {list.map((u) => (
              <option key={u._id} value={u.name}>
                {u.name}{u.label && u.label.toLowerCase() !== u.name.toLowerCase() ? ` — ${u.label}` : ''}
              </option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
}
