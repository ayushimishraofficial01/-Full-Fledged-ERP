const router = require('express').Router();
const c = require('../controllers/auth.controller');
const v = require('../validators/auth.validators');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, validate(v.register), c.register);
router.post('/login', authLimiter, validate(v.login), c.login);
router.post('/google', authLimiter, validate(v.googleLogin), c.googleLogin);
router.post('/logout', c.logout);
router.post('/logout-all', protect, c.logoutAll);
router.get('/me', protect, c.me);
router.post('/forgot-password', authLimiter, validate(v.forgotPassword), c.forgotPassword);
router.post('/reset-password/:token', authLimiter, validate(v.resetPassword), c.resetPassword);
router.put('/profile', protect, validate(v.updateProfile), c.updateProfile);
router.put('/password', protect, authLimiter, validate(v.changePassword), c.changePassword);

module.exports = router;
