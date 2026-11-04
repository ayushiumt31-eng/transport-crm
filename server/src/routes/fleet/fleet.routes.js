const express = require('express');
const controller = require('../../controllers/fleet/fleet.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const {
    allocationCreateSchema,
    allocationListQuerySchema,
    allocationParamsSchema,
    allocationStatusSchema,
    vehicleIdParamsSchema,
    vehicleListQuerySchema,
    vehicleSchema,
    vehicleStatusSchema,
    vehicleUpdateSchema
} = require('../../validations/fleet/fleet.validation');
const Joi = require('joi');

const router = express.Router();
router.use(verifyAccessToken, requireRole(...STAFF_ROLES));

router.get('/dashboard', controller.getFleetDashboard);
router.get('/allocations/options/bookings', controller.listAllocatableBookings);
router.get('/allocations/options/vehicles', validate(Joi.object({
    bookingId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
}).unknown(false), 'query'), controller.listAllocatableVehicles);
router.get('/allocations', validate(allocationListQuerySchema, 'query'), controller.listAllocations);
router.post('/allocations', validate(allocationCreateSchema), controller.createAllocation);
router.patch('/allocations/:id/status', validate(allocationParamsSchema, 'params'), validate(allocationStatusSchema), controller.updateAllocationStatus);

router.get('/', validate(vehicleListQuerySchema, 'query'), controller.listVehicles);
router.post('/', validate(vehicleSchema), controller.createVehicle);
router.patch('/:id/status', validate(vehicleIdParamsSchema, 'params'), validate(vehicleStatusSchema), controller.updateVehicleStatus);
router.patch('/:id', validate(vehicleIdParamsSchema, 'params'), validate(vehicleUpdateSchema), controller.updateVehicle);
router.delete('/:id', validate(vehicleIdParamsSchema, 'params'), controller.deleteVehicle);

module.exports = router;
