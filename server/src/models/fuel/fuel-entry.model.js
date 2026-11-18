const mongoose = require('mongoose');

const fuelEntrySchema = new mongoose.Schema({
    idempotencyKey: { type: String, required: true, unique: true, maxlength: 128 },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FleetVehicle', required: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
    filledAt: { type: Date, required: true },
    quantityMilli: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, enum: ['Litre', 'Kg', 'KWh'] },
    pricePerUnitPaise: { type: Number, required: true, min: 1 },
    totalCostPaise: { type: Number, required: true, min: 1 },
    odometerKm: { type: Number, required: true, min: 0 },
    isFullTank: { type: Boolean, required: true, default: false },
    mileageDistanceKm: { type: Number, default: null, min: 1 },
    mileageFuelQuantityMilli: { type: Number, default: null, min: 1 },
    mileageMilliPerUnit: { type: Number, default: null, min: 1 },
    vendor: { type: String, trim: true, default: '', maxlength: 150 },
    receiptNumber: { type: String, trim: true, default: '', maxlength: 100 },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
    createdBy: { type: String, required: true, maxlength: 100 },
    createdByRole: { type: String, required: true, enum: ['admin', 'manager'] }
}, { timestamps: true, versionKey: false });

fuelEntrySchema.index({ vehicleId: 1, odometerKm: -1, _id: -1 });
fuelEntrySchema.index({ filledAt: -1, _id: -1 });
fuelEntrySchema.index({ vehicleId: 1, filledAt: -1 });

module.exports = mongoose.model('FuelEntry', fuelEntrySchema);
