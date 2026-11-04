const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/auth.controller');
const { verifyAccessToken, requireRole, STAFF_ROLES } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const {
    loginSchema,
    changePasswordSchema,
    registerCustomerSchema,
    upsertAccountSchema
} = require('../validations/auth/auth.validation');

// Mounted at /api/v1/auth — one login for every role (super admin, manager, driver, customer).
router.post('/login', validate(loginSchema), authController.login);
router.post('/register', validate(registerCustomerSchema), authController.register);

router.get('/session', verifyAccessToken, authController.getSession);
router.post('/change-password', verifyAccessToken, validate(changePasswordSchema), authController.changePassword);

// Staff set up or reset logins for managers (super admin only), drivers and customers.
router.get('/accounts/:role/:profileId', verifyAccessToken, requireRole(...STAFF_ROLES), authController.getAccount);
router.put('/accounts/:role/:profileId', verifyAccessToken, requireRole(...STAFF_ROLES), validate(upsertAccountSchema), authController.upsertAccount);

module.exports = router;
