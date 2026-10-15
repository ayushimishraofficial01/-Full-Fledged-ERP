const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown } = require('./helpers');
const { Inventory, ProductionStock, StockTransaction } = require('../src/models');

let agent;
let product;
let warehouseA;
let warehouseB;

before(async () => {
  ({ agent } = await setup());
  const firstWarehouse = await agent.post('/api/warehouses').send({
    name: 'Stock Flow Warehouse A',
    code: 'FLOW-A',
    location: 'Test',
    city: 'Test',
    state: 'Test',
  }).expect(201);
  warehouseA = firstWarehouse.body.warehouse._id;

  const secondWarehouse = await agent.post('/api/warehouses').send({
    name: 'Stock Flow Warehouse B',
    code: 'FLOW-B',
    location: 'Test',
    city: 'Test',
    state: 'Test',
  }).expect(201);
  warehouseB = secondWarehouse.body.warehouse._id;

  const createdProduct = await agent.post('/api/products').send({
    name: 'Stock Flow Test Product',
    sku: 'FLOW-TEST-001',
    category: 'Test',
    unit: 'PCS',
    stockUnit: 'PCS',
  }).expect(201);
  product = createdProduct.body.product;
});

after(teardown);

test('stock movement, orders, and production keep warehouse and production balances consistent', async () => {
  const getWarehouseQty = async (warehouse) => {
    const result = await agent.get('/api/inventory/available')
      .query({ product: product._id, warehouse })
      .expect(200);
    return result.body.quantity;
  };
  const getProductionQty = async () => {
    const result = await agent.get(`/api/production/available/${product._id}`).expect(200);
    return result.body.quantity;
  };

  await agent.post('/api/stock/in').send({
    product: product._id,
    warehouse: warehouseA,
    quantity: 100,
  }).expect(201);
  assert.equal(await getWarehouseQty(warehouseA), 100);
  assert.equal(await getWarehouseQty(warehouseB), 0);

  await agent.post('/api/stock/transfer').send({
    product: product._id,
    fromWarehouse: warehouseA,
    toWarehouse: warehouseB,
    quantity: 30,
  }).expect(201);
  assert.equal(await getWarehouseQty(warehouseA), 70);
  assert.equal(await getWarehouseQty(warehouseB), 30);

  await agent.post('/api/orders').send({
    customerName: 'Stock Flow Order Customer',
    items: [{ productId: product._id, quantity: 5, unit: 'PCS' }],
  }).expect(201);
  assert.equal(await getWarehouseQty(warehouseA), 70);
  assert.equal(await getWarehouseQty(warehouseB), 30);

  await agent.post('/api/stock/out').send({
    product: product._id,
    warehouse: warehouseA,
    quantity: 10,
    reason: 'Dispatch',
    referenceNumber: 'FLOW-INV-001',
  }).expect(201);
  assert.equal(await getWarehouseQty(warehouseA), 60);
  assert.equal(await getWarehouseQty(warehouseB), 30);

  await agent.post('/api/production').send({
    product: product._id,
    quantityProduced: 50,
    unit: 'PCS',
    productionDate: new Date().toISOString(),
    referenceNumber: 'FLOW-PROD-001',
  }).expect(201);
  assert.equal(await getProductionQty(), 50);
  assert.equal(await getWarehouseQty(warehouseA), 60);
  assert.equal(await getWarehouseQty(warehouseB), 30);

  await agent.post('/api/production/transfer').send({
    product: product._id,
    toWarehouse: warehouseB,
    quantity: 20,
    unit: 'PCS',
    transferDate: new Date().toISOString(),
    referenceNumber: 'FLOW-PROD-TRANSFER-001',
  }).expect(201);
  assert.equal(await getProductionQty(), 30);
  assert.equal(await getWarehouseQty(warehouseA), 60);
  assert.equal(await getWarehouseQty(warehouseB), 50);

  const warehouseBalances = await Inventory.find({ product: product._id }).lean();
  assert.equal(warehouseBalances.reduce((sum, row) => sum + row.quantity, 0), 110);
  const productionStock = await ProductionStock.findOne({ product: product._id }).lean();
  assert.equal(productionStock.quantity, 30);
  assert.equal(productionStock.totalProduced, 50);
  assert.equal(productionStock.totalTransferred, 20);

  const dispatch = await StockTransaction.findOne({ product: product._id, referenceNumber: 'FLOW-INV-001' }).lean();
  assert.equal(dispatch.type, 'STOCK_OUT');
  assert.equal(dispatch.balanceAfter, 60);
  const transferLines = await StockTransaction.find({ product: product._id, referenceNumber: 'FLOW-PROD-TRANSFER-001' }).lean();
  assert.deepEqual(transferLines.map((line) => line.type).sort(), ['PRODUCTION_TRANSFER_OUT', 'WAREHOUSE_TRANSFER_IN']);
});
