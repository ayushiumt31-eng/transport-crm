const mongoose = require('mongoose');

const tripStatusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
        enum: ['Scheduled', 'Assigned', 'InProgress', 'Delayed', 'Completed', 'Cancelled']
    },
    remarks: { type: String, trim: true, default: '', maxlength: 1000 },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager', 'driver'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const tripSchema = new mongoose.Schema({
    tripNumber: { type: String, required: true, unique: true },
    allocationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VehicleAllocation',
        required: true,
        unique: true
    },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FleetVehicle', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
    scheduledAt: { type: Date, required: true },
    expectedDeliveryAt: { type: Date, required: true },
    actualStartedAt: { type: Date, default: null },
    actualCompletedAt: { type: Date, default: null },
    routeId: { type: String, trim: true, default: '', maxlength: 100 },
    notes: { type: String, trim: true, default: '', maxlength: 2000 },
    delayReason: { type: String, trim: true, default: '', maxlength: 1000 },
    cancellationReason: { type: String, trim: true, default: '', maxlength: 1000 },
    tripStatus: {
        type: String,
        required: true,
        enum: ['Scheduled', 'Assigned', 'Starting', 'InProgress', 'Delayed', 'Completing', 'Cancelling', 'Completed', 'Cancelled'],
        default: 'Scheduled'
    },
    statusUpdatedAt: { type: Date, default: Date.now },
    statusHistory: { type: [tripStatusHistorySchema], default: [] }
}, { timestamps: true, versionKey: false });

tripSchema.index({ tripStatus: 1, scheduledAt: 1, _id: 1 });
tripSchema.index({ driverId: 1, tripStatus: 1, scheduledAt: -1 });
tripSchema.index({ vehicleId: 1, tripStatus: 1 });

const tripCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 }
}, { versionKey: false });

const Trip = mongoose.model('Trip', tripSchema);
const TripCounter = mongoose.models.TripCounter || mongoose.model('TripCounter', tripCounterSchema);

module.exports = { Trip, TripCounter };
