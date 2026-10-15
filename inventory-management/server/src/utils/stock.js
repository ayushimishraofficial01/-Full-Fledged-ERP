const STOCK_STATUS = Object.freeze({
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
});

const TRANSACTION_TYPES = Object.freeze({
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  PRODUCTION_IN: 'PRODUCTION_IN',
  PRODUCTION_TRANSFER_OUT: 'PRODUCTION_TRANSFER_OUT',
  WAREHOUSE_TRANSFER_IN: 'WAREHOUSE_TRANSFER_IN',
});

// Quantities are stored with up to 3 decimals (e.g. 12.345 KG). EPSILON absorbs floating point drift.
const QTY_DECIMALS = 3;
const EPSILON = 1e-6;

function roundQty(n) {
  const f = 10 ** QTY_DECIMALS;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

function getStockStatus(quantity, minimumStock = 0) {
  const q = Number(quantity) || 0;
  if (q <= EPSILON) return STOCK_STATUS.OUT_OF_STOCK;
  if (q < Number(minimumStock || 0)) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

/** Same rule as getStockStatus, expressed as a MongoDB aggregation expression. */
function stockStatusExpr(qtyExpr, minExpr) {
  return {
    $switch: {
      branches: [
        { case: { $lte: [qtyExpr, EPSILON] }, then: STOCK_STATUS.OUT_OF_STOCK },
        { case: { $lt: [qtyExpr, { $ifNull: [minExpr, 0] }] }, then: STOCK_STATUS.LOW_STOCK },
      ],
      default: STOCK_STATUS.IN_STOCK,
    },
  };
}

function formatQty(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: QTY_DECIMALS }).format(roundQty(n));
}

module.exports = { STOCK_STATUS, TRANSACTION_TYPES, EPSILON, QTY_DECIMALS, roundQty, getStockStatus, stockStatusExpr, formatQty };
