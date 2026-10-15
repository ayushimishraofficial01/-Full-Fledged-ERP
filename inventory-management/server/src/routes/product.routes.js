const router = require('express').Router();
const c = require('../controllers/product.controller');
const { productBody, listQuery } = require('../validators/product.validators');
const validate = require('../middleware/validate');
const { productImage } = require('../middleware/upload');
const { requirePermission } = require('../middleware/authorization');

router.get('/', requirePermission('products.view'), validate(listQuery, 'query'), c.list);
router.get('/categories', requirePermission('products.view'), c.categories);
router.get('/:id', requirePermission('products.view'), c.get);
router.post('/', requirePermission('products.create'), productImage, validate(productBody), c.create);
router.put('/:id', requirePermission('products.edit'), productImage, validate(productBody), c.update);
router.delete('/:id', requirePermission('products.delete'), c.remove);
router.patch('/:id/restore', c.restore);

module.exports = router;
