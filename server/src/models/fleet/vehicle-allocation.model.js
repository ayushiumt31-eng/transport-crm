const mongoose = require('mongoose');

const allocationHistorySchema = new mongoose.Schema({
    status: { type: String, required: true, enum: ['Allocated', 'Released', 'Cancelled'] },
    remarks: { type: String, trim: true, default: '', maxlength: 500 },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager', 'driver'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const allocationSchema = new mongoose.Schema({
    allocationNumber: { type: String, required: true, unique: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FleetVehicle', required: true },
    plannedPickupDate: { type: Date, required: true },
    plannedDeliveryDate: { type: Date, required: true },
    remarks: { type: String, trim: true, default: '', maxlength: 500 },
    allocationStatus: { type: String, required: true, enum: ['Allocated', 'Released', 'Cancelled'], default: 'Allocated' },
    statusHistory: { type: [allocationHistorySchema], default: [] }
}, { timestamps: true, versionKey: false });

allocationSchema.index({ bookingId: 1 }, {
    unique: true,
    partialFilterExpression: { allocationStatus: 'Allocated' }
});
allocationSchema.index({ vehicleId: 1, plannedPickupDate: 1, plannedDeliveryDate: 1 });
allocationSchema.index({ allocationStatus: 1, createdAt: -1 });

const allocationCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 }
}, { versionKey: false });

const VehicleAllocation = mongoose.model('VehicleAllocation', allocationSchema);
const VehicleAllocationCounter = mongoose.model('VehicleAllocationCounter', allocationCounterSchema);

module.exports = { VehicleAllocation, VehicleAllocationCounter };
