import { FilterBar, FilterSelect, SearchInput } from '../ui';
import { useMeta } from '../../context/MetaContext';

export default function InventoryFilters({ params, update, reset, showWarehouse = true, showStatus = true, lowOnly = false }) {
  const { warehouses, categories, units } = useMeta();
  const filtered = Boolean(params.search || params.category || params.unit || (showStatus && params.stockStatus) || (showWarehouse && params.warehouse));
  return (
    <FilterBar showReset={filtered} onReset={reset}>
      <SearchInput value={params.search || ''} onChange={(v) => update({ search: v })} placeholder="Search product or SKU" className="lg:w-64" />
      {showWarehouse && (
        <FilterSelect value={params.warehouse} onChange={(v) => update({ warehouse: v })} label="Warehouse" className="lg:w-52">
          <option value="">All warehouses</option>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </FilterSelect>
      )}
      <FilterSelect value={params.category} onChange={(v) => update({ category: v })} label="Category">
        <option value="">All categories</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </FilterSelect>
      <FilterSelect value={params.unit} onChange={(v) => update({ unit: v })} label="Unit" className="lg:w-32">
        <option value="">All units</option>
        {units.map((u) => <option key={u._id} value={u.name}>{u.name}</option>)}
      </FilterSelect>
      {showStatus && (
        <FilterSelect value={params.stockStatus} onChange={(v) => update({ stockStatus: v })} label="Stock status">
          {lowOnly ? <option value="">Low + Out of stock</option> : <option value="">Any stock status</option>}
          {!lowOnly && <option value="IN_STOCK">In Stock</option>}
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </FilterSelect>
      )}
    </FilterBar>
  );
}
