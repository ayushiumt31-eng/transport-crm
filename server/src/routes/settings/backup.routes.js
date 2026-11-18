const express = require('express');
const controller = require('../../controllers/settings/backup.controller');
const { requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');

const router = express.Router();
router.use(verifyAccessToken, requireRole('admin'));
router.get('/status', controller.getStatus);
router.post('/local', controller.downloadLocalBackup);

module.exports = router;
