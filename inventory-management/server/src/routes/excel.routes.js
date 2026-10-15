const express = require('express');
const c = require('../controllers/excel.controller');
const { excelFile } = require('../middleware/upload');
const { requirePermission } = require('../middleware/authorization');

const importRouter = express.Router();
importRouter.get('/template', c.template);
importRouter.post('/products/preview', requirePermission('products.import'), excelFile, c.preview);
// Confirmed rows can be large; allow a bigger JSON body on this route only.
importRouter.post('/products', requirePermission('products.import'), express.json({ limit: '15mb' }), c.commit);

const exportRouter = express.Router();
exportRouter.get('/products', requirePermission('products.export'), c.products);
exportRouter.get('/inventory', requirePermission('inventory.export'), c.inventory);
exportRouter.get('/transactions', requirePermission('reports.export'), c.transactions);
exportRouter.get('/transfers', requirePermission('reports.export'), c.transfers);
exportRouter.get('/warehouses', requirePermission('reports.export'), c.warehouses);
exportRouter.get('/production', requirePermission('reports.export'), c.production);
exportRouter.get('/production', c.production);

module.exports = { importRouter, exportRouter };
