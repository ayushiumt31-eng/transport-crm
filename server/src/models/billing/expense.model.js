const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    idempotencyKey: { type: String, required: true, maxlength: 128 },
    category: {
        type: String,
        required: true,
        enum: ['Fuel', 'Toll', 'Maintenance', 'Driver', 'Operations', 'Other']
    },
    description: { type: String, trim: true, required: true, maxlength: 500 },
    amountPaise: { type: Number, required: true, min: 1, max: Number.MAX_SAFE_INTEGER },
    incurredAt: { type: Date, required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FleetVehicle', default: null },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
    vendor: { type: String, trim: true, default: '', maxlength: 150 },
    reference: { type: String, trim: true, default: '', maxlength: 100 },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    createdBy: { type: String, required: true, maxlength: 100 },
    createdByRole: { type: String, required: true, enum: ['admin', 'manager'] }
}, { timestamps: true, versionKey: false });

expenseSchema.index({ incurredAt: -1, _id: -1 });
expenseSchema.index({ category: 1, incurredAt: -1 });
expenseSchema.index({ vehicleId: 1, incurredAt: -1 });
expenseSchema.index({ idempotencyKey: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model('Expense', expenseSchema);
