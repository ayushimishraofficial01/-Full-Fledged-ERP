const XLSX = require('xlsx');
const mongoose = require('mongoose');
const env = require('../config/env');
const { Product, Warehouse, Inventory, StockTransaction } = require('../models');
const ApiError = require('../utils/ApiError');
const { roundQty, TRANSACTION_TYPES } = require('../utils/stock');
const { unitKey } = require('../utils/units');
const { getUnitLookup } = require('./unit.service');
const { runAtomic } = require('./transaction.service');
const { buildWorkbook } = require('./export.service');

// Normalised header (lower-case, letters/digits only) -> field name.
const HEADER_MAP = {
  productname: 'name', name: 'name', product: 'name', itemname: 'name',
  sku: 'sku', productcode: 'sku', skuproductcode: 'sku', skucode: 'sku', itemcode: 'sku',
  category: 'category',
  brand: 'brand',
  hsn: 'hsn', hsncode: 'hsn', hsnnumber: 'hsn', hsnsac: 'hsn',
  size: 'size',
  unit: 'unit', sizeunit: 'unit', uom: 'unit',
  stockunit: 'stockUnit', countunit: 'stockUnit', quantityunit: 'stockUnit', qtyunit: 'stockUnit',
  warehouse: 'warehouse', warehousename: 'warehouse', warehousecode: 'warehouse',
  quantity: 'quantity', qty: 'quantity', openingstock: 'quantity', openingquantity: 'quantity', stock: 'quantity',
  minimumstock: 'minimumStock', minstock: 'minimumStock', minimumstocklevel: 'minimumStock', reorderlevel: 'minimumStock', minimumquantity: 'minimumStock',
  price: 'price', priceinr: 'price', sellingprice: 'price', unitprice: 'price',
  description: 'description',
};
const REQUIRED_COLUMNS = { name: 'Product Name', sku: 'SKU', unit: 'Unit', warehouse: 'Warehouse', quantity: 'Quantity' };
const FIELDS = ['name', 'sku', 'category', 'brand', 'hsn', 'size', 'unit', 'stockUnit', 'warehouse', 'quantity', 'minimumStock', 'description', 'price'];

const normHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const upperKey = (v) => str(v).replace(/\s+/g, ' ').toUpperCase();

function toNumber(v) {
  if (v === undefined || v === null || v === '') return { empty: true };
  if (typeof v === 'number') return { value: v };
  const cleaned = String(v).replace(/,/g, '').trim();
  if (cleaned === '') return { empty: true };
  const n = Number(cleaned);
  return Number.isFinite(n) ? { value: n } : { invalid: true };
}

/** Reads the first sheet into plain row objects keyed by internal field names. */
function parseWorkbook(buffer) {
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, dense: true, sheetRows: env.maxImportRows + 1 });
  } catch {
    throw ApiError.badRequest('Could not read the file. Please upload a valid Excel (.xlsx/.xls) or CSV file.');
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw ApiError.badRequest('The file does not contain any sheet.');
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true, blankrows: false });
  if (!matrix.length) throw ApiError.badRequest('The sheet is empty.');

  const headerRow = matrix[0].map((h) => HEADER_MAP[normHeader(h)] || null);
  const missing = Object.entries(REQUIRED_COLUMNS).filter(([f]) => !headerRow.includes(f)).map(([, label]) => label);
  if (missing.length) {
    throw ApiError.badRequest(`Missing required column(s): ${missing.join(', ')}. Download the template to see the expected format.`, missing.map((m) => ({ field: m, message: 'Column missing' })));
  }

  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const cells = matrix[i];
    const row = { row: i + 1 };
    let hasValue = false;
    headerRow.forEach((field, c) => {
      if (!field || row[field] !== undefined) return;
      const v = cells[c];
      row[field] = typeof v === 'string' ? v.trim() : v;
      if (v !== '' && v !== null && v !== undefined) hasValue = true;
    });
    if (hasValue) rows.push(row);
  }
  if (!rows.length) throw ApiError.badRequest('No data rows found below the header row.');
  if (rows.length > env.maxImportRows) throw ApiError.badRequest(`Too many rows. Maximum ${env.maxImportRows} rows per import.`);
  return { sheetName, rows };
}

/**
 * Validates import rows against business rules and the database.
 * Never writes anything. Returns per-row status, errors, warnings and the planned action.
 */
async function validateRows(inputRows, { updateExisting = false } = {}) {
  const units = await getUnitLookup();
  const warehouses = await Warehouse.find({ isArchived: { $ne: true } }).select('name code status').lean();
  const whByKey = new Map();
  warehouses.forEach((w) => {
    whByKey.set(upperKey(w.code), w);
    whByKey.set(upperKey(w.name), w);
  });
  // Allow "Kanpur" to match "Kanpur Warehouse" when unambiguous.
  const whByShort = new Map();
  warehouses.forEach((w) => {
    const short = upperKey(w.name).replace(/\s+WAREHOUSE$/, '');
    whByShort.set(short, whByShort.has(short) ? null : w);
  });

  const skus = [...new Set(inputRows.map((r) => upperKey(r.sku)).filter(Boolean))];
  const existing = await Product.find({ sku: { $in: skus } }).lean();
  const existingBySku = new Map(existing.map((p) => [p.sku, p]));

  const firstBySku = new Map();
  const seenSkuWarehouse = new Map();
  const results = [];

  for (const raw of inputRows) {
    const errors = [];
    const warnings = [];
    const rowNo = Number(raw.row) || results.length + 2;

    const name = str(raw.name);
    const sku = upperKey(raw.sku);
    const category = str(raw.category);
    const brand = str(raw.brand);
    const hsn = str(raw.hsn).replace(/[\s.]/g, '');
    const description = str(raw.description);

    if (!name) errors.push('Product Name missing');
    else if (name.length > 200) errors.push('Product Name is longer than 200 characters');
    if (!sku) errors.push('SKU missing');
    else if (!/^[A-Z0-9][A-Z0-9._\-/]*$/.test(sku) || sku.length > 60) errors.push('SKU may contain only letters, numbers, ".", "-", "_" and "/" (max 60)');
    if (hsn && !/^(\d{4}|\d{6}|\d{8})$/.test(hsn)) errors.push('HSN must be 4, 6 or 8 digits');

    let unit = null;
    if (!str(raw.unit)) errors.push('Unit missing');
    else {
      unit = units.get(unitKey(raw.unit)) || null;
      if (!unit) errors.push(`Unit "${str(raw.unit)}" is not recognised. Add it in Settings > Units first.`);
    }

    let stockUnit = null;
    if (str(raw.stockUnit)) {
      stockUnit = units.get(unitKey(raw.stockUnit)) || null;
      if (!stockUnit) errors.push(`Stock Unit "${str(raw.stockUnit)}" is not recognised`);
    }

    const size = toNumber(raw.size);
    if (size.invalid) errors.push('Size must be numeric');
    else if (!size.empty && size.value < 0) errors.push('Size cannot be negative');

    const qty = toNumber(raw.quantity);
    let quantity = 0;
    if (qty.invalid) errors.push('Quantity must be numeric');
    else if (!qty.empty) {
      if (qty.value < 0) errors.push('Quantity cannot be negative');
      else if (Math.abs(qty.value * 1000 - Math.round(qty.value * 1000)) > 1e-6) errors.push('Quantity can have at most 3 decimal places');
      else quantity = roundQty(qty.value);
    }

    const min = toNumber(raw.minimumStock);
    if (min.invalid) errors.push('Minimum Stock must be numeric');
    else if (!min.empty && min.value < 0) errors.push('Minimum Stock cannot be negative');

    const price = toNumber(raw.price);
    if (price.invalid) errors.push('Price must be numeric');
    else if (!price.empty && (price.value < 0 || price.value > 1e12 || Math.abs(price.value * 100 - Math.round(price.value * 100)) > 1e-6)) {
      errors.push('Price must be a non-negative amount with at most 2 decimal places');
    }

    let warehouse = null;
    const whRaw = str(raw.warehouse);
    if (!whRaw) errors.push('Warehouse missing');
    else {
      warehouse = whByKey.get(upperKey(whRaw)) || whByShort.get(upperKey(whRaw).replace(/\s+WAREHOUSE$/, '')) || null;
      if (!warehouse) errors.push(`Warehouse "${whRaw}" not found`);
      else if (warehouse.status !== 'active' && quantity > 0) errors.push(`Warehouse "${warehouse.name}" is inactive`);
    }

    // Consistency with existing product (same SKU in database).
    const dbProduct = sku ? existingBySku.get(sku) : null;
    let action = 'create';
    if (dbProduct) {
      action = updateExisting ? 'update' : 'stock';
      if (dbProduct.isArchived) errors.push(`SKU ${sku} belongs to an archived product. Restore it first.`);
      if (stockUnit && dbProduct.stockUnit !== stockUnit) errors.push(`Stock Unit must be ${dbProduct.stockUnit} for existing SKU ${sku}`);
      if (!stockUnit) stockUnit = dbProduct.stockUnit;
      if (name && name.toLowerCase() !== dbProduct.name.toLowerCase()) {
        warnings.push(updateExisting
          ? `SKU ${sku} exists as "${dbProduct.name}"; its name will be changed to "${name}"`
          : `SKU ${sku} already exists as "${dbProduct.name}"; stock will be added to that product`);
      }
    } else {
      if (!stockUnit) stockUnit = 'PCS';
      if (!category) warnings.push('Category missing; "Uncategorized" will be used');
    }

    // Consistency inside the file: one SKU must always describe the same product.
    if (sku) {
      const first = firstBySku.get(sku);
      if (first) {
        const diffs = [];
        const currentPrice = price.empty ? null : price.value;
        if (name && first.name && name.toLowerCase() !== first.name.toLowerCase()) diffs.push('name');
        if (unit && first.unit && unit !== first.unit) diffs.push('unit');
        if (!size.empty && first.size !== null && size.value !== first.size) diffs.push('size');
        if (stockUnit && first.stockUnit && stockUnit !== first.stockUnit) diffs.push('stock unit');
        if ((first.price !== null || currentPrice !== null) && first.price !== currentPrice) diffs.push('price');
        if (diffs.length) errors.push(`SKU ${sku} is used in row ${first.row} with a different ${diffs.join(', ')}`);
      } else {
        firstBySku.set(sku, { row: rowNo, name, unit, size: size.empty ? null : size.value, stockUnit, price: price.empty ? null : price.value });
      }
      if (warehouse) {
        const key = `${sku}|${warehouse._id}`;
        if (seenSkuWarehouse.has(key)) errors.push(`Duplicate row: SKU ${sku} for ${warehouse.name} already appears in row ${seenSkuWarehouse.get(key)}`);
        else seenSkuWarehouse.set(key, rowNo);
      }
    }

    if (quantity === 0 && !qty.invalid && !errors.length) warnings.push('Quantity is 0; no stock will be added');

    results.push({
      row: rowNo,
      status: errors.length ? 'error' : 'valid',
      action,
      errors,
      warnings,
      input: FIELDS.reduce((o, f) => ({ ...o, [f]: raw[f] === undefined || raw[f] === null ? '' : raw[f] }), { row: rowNo }),
      data: {
        name,
        sku,
        category: category || (dbProduct ? dbProduct.category : 'Uncategorized'),
        brand,
        hsn,
        size: size.empty || size.invalid ? null : size.value,
        unit,
        stockUnit,
        warehouseId: warehouse ? String(warehouse._id) : null,
        warehouseName: warehouse ? warehouse.name : whRaw,
        quantity,
        minimumStock: min.empty || min.invalid ? null : min.value,
        price: price.empty || price.invalid ? dbProduct?.price ?? null : price.value,
        description,
        existingProductId: dbProduct ? String(dbProduct._id) : null,
      },
    });
  }

  const valid = results.filter((r) => r.status === 'valid');
  const byUnit = {};
  valid.forEach((r) => {
    if (r.data.quantity > 0) byUnit[r.data.stockUnit] = roundQty((byUnit[r.data.stockUnit] || 0) + r.data.quantity);
  });
  return {
    rows: results,
    summary: {
      totalRows: results.length,
      validRows: valid.length,
      errorRows: results.length - valid.length,
      warningRows: results.filter((r) => r.warnings.length).length,
      newProducts: new Set(valid.filter((r) => r.action === 'create').map((r) => r.data.sku)).size,
      existingProducts: new Set(valid.filter((r) => r.action !== 'create').map((r) => r.data.sku)).size,
      quantityByUnit: Object.entries(byUnit).map(([unit, quantity]) => ({ unit, quantity })),
    },
  };
}

async function previewImport(file, options) {
  const { sheetName, rows } = parseWorkbook(file.buffer);
  const result = await validateRows(rows, options);
  return { fileName: file.originalname, sheetName, ...result };
}

function chunk(arr, size = 1000) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Re-validates the confirmed rows and applies them atomically:
 * creates/updates products, adds opening stock to inventory and writes STOCK_IN ledger lines.
 */
async function commitImport({ rows, updateExisting, fileName }, user) {
  if (!Array.isArray(rows) || !rows.length) throw ApiError.badRequest('Nothing to import.');
  if (rows.length > env.maxImportRows) throw ApiError.badRequest(`Too many rows. Maximum ${env.maxImportRows} rows per import.`);

  const { rows: checked } = await validateRows(rows, { updateExisting });
  const invalid = checked.filter((r) => r.status === 'error');
  if (invalid.length) {
    throw ApiError.unprocessable(`${invalid.length} row(s) failed validation. Fix them or import only the valid rows.`,
      invalid.slice(0, 200).map((r) => ({ row: r.row, message: r.errors.join('; ') })));
  }

  const now = new Date();
  const reference = `IMP-${now.toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
  const notes = `Excel import${fileName ? `: ${String(fileName).slice(0, 150)}` : ''}`;

  return runAtomic(async (session, undo) => {
    const opt = { session: session || undefined };
    const productBySku = new Map();

    // 1. Products: create new ones, optionally update existing ones.
    const firstRowBySku = new Map();
    checked.forEach((r) => { if (!firstRowBySku.has(r.data.sku)) firstRowBySku.set(r.data.sku, r.data); });

    const toCreate = [];
    const toUpdate = [];
    for (const d of firstRowBySku.values()) {
      if (d.existingProductId) {
        productBySku.set(d.sku, { _id: new mongoose.Types.ObjectId(d.existingProductId), stockUnit: d.stockUnit });
        if (updateExisting) toUpdate.push(d);
      } else {
        const _id = new mongoose.Types.ObjectId();
        productBySku.set(d.sku, { _id, stockUnit: d.stockUnit });
        toCreate.push({
          _id, name: d.name, sku: d.sku, category: d.category, brand: d.brand, hsn: d.hsn, size: d.size,
          unit: d.unit, stockUnit: d.stockUnit, price: d.price, minimumStock: d.minimumStock ?? 0, description: d.description,
          status: 'active', createdBy: user._id, updatedBy: user._id,
        });
      }
    }

    for (const part of chunk(toCreate)) {
      await Product.insertMany(part, { ...opt, ordered: true });
      if (undo) undo.push(() => Product.deleteMany({ _id: { $in: part.map((p) => p._id) } }));
    }

    if (toUpdate.length) {
      const before = await Product.find({ _id: { $in: toUpdate.map((d) => d.existingProductId) } }).session(session || null).lean();
      if (undo) {
        undo.push(() => Product.bulkWrite(before.map((b) => ({
          updateOne: { filter: { _id: b._id }, update: { $set: { name: b.name, category: b.category, brand: b.brand, hsn: b.hsn, size: b.size, unit: b.unit, price: b.price, minimumStock: b.minimumStock, description: b.description } } },
        }))));
      }
      const ops = toUpdate.map((d) => {
        const $set = { name: d.name, unit: d.unit, updatedBy: user._id };
        if (d.category) $set.category = d.category;
        if (d.brand) $set.brand = d.brand;
        if (d.hsn) $set.hsn = d.hsn;
        if (d.size !== null) $set.size = d.size;
        if (d.minimumStock !== null) $set.minimumStock = d.minimumStock;
        if (d.price !== null) $set.price = d.price;
        if (d.description) $set.description = d.description;
        return { updateOne: { filter: { _id: d.existingProductId }, update: { $set } } };
      });
      for (const part of chunk(ops)) await Product.bulkWrite(part, opt);
    }

    // 2. Inventory + ledger for rows with quantity > 0.
    const stockRows = checked.filter((r) => r.data.quantity > 0).map((r) => ({
      product: productBySku.get(r.data.sku),
      warehouseId: new mongoose.Types.ObjectId(r.data.warehouseId),
      quantity: r.data.quantity,
    }));

    let transactionsCreated = 0;
    if (stockRows.length) {
      const productIds = [...new Set(stockRows.map((s) => String(s.product._id)))];
      const current = await Inventory.find({ product: { $in: productIds } }).session(session || null).select('product warehouse quantity').lean();
      const currentQty = new Map(current.map((c) => [`${c.product}|${c.warehouse}`, c.quantity]));

      const invOps = stockRows.map((s) => ({
        updateOne: {
          filter: { product: s.product._id, warehouse: s.warehouseId },
          update: { $inc: { quantity: s.quantity }, $set: { unit: s.product.stockUnit, lastTransactionAt: now } },
          upsert: true,
        },
      }));
      for (const part of chunk(invOps)) await Inventory.bulkWrite(part, { ...opt, ordered: true });
      if (undo) {
        undo.push(() => Inventory.bulkWrite(stockRows.map((s) => ({
          updateOne: { filter: { product: s.product._id, warehouse: s.warehouseId }, update: { $inc: { quantity: -s.quantity } } },
        }))));
      }

      const txDocs = stockRows.map((s) => ({
        _id: new mongoose.Types.ObjectId(),
        product: s.product._id,
        warehouse: s.warehouseId,
        type: TRANSACTION_TYPES.STOCK_IN,
        quantity: s.quantity,
        unit: s.product.stockUnit,
        balanceAfter: roundQty((currentQty.get(`${s.product._id}|${s.warehouseId}`) || 0) + s.quantity),
        referenceNumber: reference,
        notes,
        source: 'import',
        performedBy: user._id,
        date: now,
      }));
      for (const part of chunk(txDocs)) {
        await StockTransaction.insertMany(part, { ...opt, ordered: true });
        if (undo) undo.push(() => StockTransaction.deleteMany({ _id: { $in: part.map((t) => t._id) } }));
      }
      transactionsCreated = txDocs.length;
    }

    return {
      reference,
      productsCreated: toCreate.length,
      productsUpdated: toUpdate.length,
      stockTransactions: transactionsCreated,
      rowsImported: checked.length,
    };
  });
}

async function buildTemplate() {
  const units = await getUnitLookup();
  const unitNames = [...new Set(units.values())].sort();
  const warehouses = await Warehouse.find({ isArchived: { $ne: true } }).select('name code').sort({ name: 1 }).lean();
  const w1 = warehouses[0]?.name || 'Kanpur Warehouse';
  const w2 = warehouses[1]?.name || warehouses[0]?.name || 'Lucknow Warehouse';

  const templateCols = ['Product Name', 'SKU', 'Category', 'Brand', 'HSN', 'Size', 'Unit', 'Stock Unit', 'Warehouse', 'Quantity', 'Minimum Stock', 'Description', 'Price (INR)'];
  const examples = [
    ['Product 1', 'P001', 'Category 1', '', '', 250, 'ML', 'PCS', w1, 5000, 500, 'Sample product', 12.5],
    ['Product 1', 'P001', 'Category 1', '', '', 250, 'ML', 'PCS', w2, 2500, 500, 'Sample product', 12.5],
    ['Product 2', 'P002', 'Category 2', '', '', 50, 'KG', 'Bag', w1, 40, 10, 'Sample product', 80],
  ];
  return buildWorkbook([
    { name: 'Products', columns: templateCols.map((h, i) => ({ header: h, value: (r) => r[i], width: Math.max(12, h.length + 4) })), rows: examples },
    {
      name: 'Instructions',
      columns: [{ header: 'Field', value: (r) => r[0], width: 18 }, { header: 'Rule', value: (r) => r[1], width: 90 }],
      rows: [
        ['Product Name', 'Required.'],
        ['SKU', 'Required. Unique product code. Repeat the same SKU on several rows to stock one product in several warehouses.'],
        ['Category', 'Recommended. "Uncategorized" is used when empty for new products.'],
        ['HSN', 'Optional. 4, 6 or 8 digits.'],
        ['Size', 'Optional number, e.g. 250.'],
        ['Unit', `Required. Unit of the size. Allowed: ${unitNames.join(', ')}`],
        ['Stock Unit', 'Optional. Unit in which quantity is counted (default PCS), e.g. a 250 ML product counted in PCS.'],
        ['Warehouse', `Required. Warehouse name or code. Existing: ${warehouses.map((w) => `${w.name} (${w.code})`).join(', ') || 'none yet - add warehouses first'}`],
        ['Quantity', 'Required number >= 0. Added to current stock as a Stock In transaction.'],
        ['Minimum Stock', 'Optional number >= 0. Used for low-stock alerts.'],
        ['Price', 'Optional INR selling price per stock unit; up to 2 decimal places.'],
        ['Existing SKUs', 'Stock is added to the existing product. Product details are updated only if you tick "Update existing product details".'],
      ],
    },
  ]);
}

module.exports = { parseWorkbook, validateRows, previewImport, commitImport, buildTemplate };
