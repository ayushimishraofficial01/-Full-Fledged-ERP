const { Product, Inventory, StockTransaction } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { roundQty, getStockStatus } = require('../utils/stock');
const { resolveUnit } = require('../services/unit.service');
const { listProducts } = require('../services/product.service');
const { productStockByWarehouse } = require('../services/inventory.service');
const { stockIn } = require('../services/stock.service');
const { removeUploadedFile } = require('../middleware/upload');

function cleanupUpload(req) {
  if (req.file) removeUploadedFile(`products/${req.file.filename}`);
}

async function normalizeUnits(body) {
  const unit = await resolveUnit(body.unit);
  if (!unit) throw ApiError.badRequest(`Unit "${body.unit}" is not available`, [{ field: 'unit', message: 'Please choose a valid unit' }]);
  const stockUnit = await resolveUnit(body.stockUnit);
  if (!stockUnit) throw ApiError.badRequest(`Stock unit "${body.stockUnit}" is not available`, [{ field: 'stockUnit', message: 'Please choose a valid stock unit' }]);
  return { unit, stockUnit };
}

exports.list = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listProducts(req.query)) });
});

exports.categories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct('category', { isArchived: { $ne: true } });
  res.json({ success: true, categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)) });
});

exports.get = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('createdBy updatedBy', 'name').lean();
  if (!product) throw ApiError.notFound('Product not found');
  const stock = await productStockByWarehouse(product._id);
  const totalStock = roundQty(stock.reduce((s, r) => s + r.quantity, 0));
  res.json({
    success: true,
    product: { ...product, totalStock, stockStatus: getStockStatus(totalStock, product.minimumStock) },
    stock: stock.map((s) => ({ ...s, status: getStockStatus(s.quantity, product.minimumStock) })),
  });
});

exports.create = asyncHandler(async (req, res) => {
  try {
    const { removeImage, quantity, warehouse, date, ...body } = req.body;
    Object.assign(body, await normalizeUnits(body));
    const product = await Product.create({
      ...body,
      size: body.size ?? null,
      image: req.file ? `products/${req.file.filename}` : null,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    if (warehouse && quantity !== undefined && Number(quantity) > 0) {
      await stockIn({ product: product._id, warehouse, quantity: Number(quantity), unit: product.stockUnit, date: date ? new Date(date) : undefined }, req.user);
    }

    res.status(201).json({ success: true, message: 'Product created', product });
  } catch (err) {
    cleanupUpload(req);
    throw err;
  }
});

exports.update = asyncHandler(async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    const { removeImage, ...body } = req.body;
    Object.assign(body, await normalizeUnits(body));

    // Stock unit is the unit of every existing inventory record and ledger line; changing it would corrupt history.
    if (body.stockUnit !== product.stockUnit && (await StockTransaction.exists({ product: product._id }))) {
      throw ApiError.badRequest(`Stock unit cannot be changed after stock movements exist (currently ${product.stockUnit}).`, [
        { field: 'stockUnit', message: `Locked to ${product.stockUnit} because stock has been recorded` },
      ]);
    }

    const oldImage = product.image;
    const updates = { ...body, size: body.size ?? null, updatedBy: req.user._id };
    if (updates.price === undefined) delete updates.price;
    Object.assign(product, updates);
    if (req.file) product.image = `products/${req.file.filename}`;
    else if (removeImage) product.image = null;
    await product.save();

    if (oldImage && oldImage !== product.image) removeUploadedFile(oldImage);
    if (body.stockUnit !== undefined) await Inventory.updateMany({ product: product._id }, { $set: { unit: product.stockUnit } });
    res.json({ success: true, message: 'Product updated', product });
  } catch (err) {
    cleanupUpload(req);
    throw err;
  }
});

/**
 * Hard delete only when the product has never moved. With history it is archived so the
 * ledger stays intact. Products still holding stock cannot be removed at all.
 */
exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');

  const inStock = await Inventory.aggregate([{ $match: { product: product._id, quantity: { $gt: 0 } } }, { $group: { _id: null, qty: { $sum: '$quantity' }, n: { $sum: 1 } } }]);
  if (inStock.length) {
    throw ApiError.conflict(
      `${product.name} still has ${roundQty(inStock[0].qty)} ${product.stockUnit} in ${inStock[0].n} warehouse(s). Stock out or transfer it before deleting.`
    );
  }

  const hasHistory = await StockTransaction.exists({ product: product._id });
  if (hasHistory) {
    product.isArchived = true;
    product.archivedAt = new Date();
    product.status = 'inactive';
    product.updatedBy = req.user._id;
    await product.save();
    return res.json({ success: true, mode: 'archived', message: `${product.name} was archived. Its transaction history is preserved.` });
  }

  await Inventory.deleteMany({ product: product._id });
  await product.deleteOne();
  if (product.image) removeUploadedFile(product.image);
  res.json({ success: true, mode: 'deleted', message: `${product.name} was deleted.` });
});

exports.restore = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  product.isArchived = false;
  product.archivedAt = undefined;
  product.status = 'active';
  product.updatedBy = req.user._id;
  await product.save();
  res.json({ success: true, message: `${product.name} restored`, product });
});
