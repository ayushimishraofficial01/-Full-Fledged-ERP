import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { productService, settingsService, warehouseService } from '../services';

/** Small, frequently used reference data (units, warehouses, categories, settings) cached app-wide. */
const MetaContext = createContext(null);

export function MetaProvider({ children }) {
  const [units, setUnits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState({ companyName: '', defaultStockUnit: 'PCS' });
  const [loaded, setLoaded] = useState(false);

  const refreshUnits = useCallback(() => settingsService.units().then((r) => setUnits(r.units)).catch(() => {}), []);
  const refreshWarehouses = useCallback(() => warehouseService.all().then((r) => setWarehouses(r.items)).catch(() => {}), []);
  const refreshCategories = useCallback(() => productService.categories().then((r) => setCategories(r.categories)).catch(() => {}), []);
  const refreshSettings = useCallback(() => settingsService.get().then((r) => setSettings(r.settings)).catch(() => {}), []);

  useEffect(() => {
    Promise.all([refreshUnits(), refreshWarehouses(), refreshCategories(), refreshSettings()]).finally(() => setLoaded(true));
  }, [refreshUnits, refreshWarehouses, refreshCategories, refreshSettings]);

  const value = useMemo(
    () => ({
      units,
      warehouses,
      activeWarehouses: warehouses.filter((w) => w.status === 'active'),
      categories,
      settings,
      setSettings,
      loaded,
      refreshUnits,
      refreshWarehouses,
      refreshCategories,
      refreshSettings,
    }),
    [units, warehouses, categories, settings, loaded, refreshUnits, refreshWarehouses, refreshCategories, refreshSettings]
  );
  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);
