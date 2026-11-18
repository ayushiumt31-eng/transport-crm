const mongoose = require('mongoose');

const shipmentStatuses = [
    'Booked',
    'ReadyForPickup',
    'PickedUp',
    'InTransit',
    'OutForDelivery',
    'Delivered',
    'Exception',
    'Cancelled'
];

const statusHistorySchema = new mongoose.Schema({
    status: { type: String, enum: shipmentStatuses, required: true },
    remarks: { type: String, trim: true, default: '', maxlength: 1000 },
    location: {
        latitude: { type: Number, min: -90, max: 90 },
        longitude: { type: Number, min: -180, max: 180 },
        label: { type: String, trim: true, default: '', maxlength: 200 }
    },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager', 'driver'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const podSchema = new mongoose.Schema({
    originalName: { type: String, trim: true, default: '', maxlength: 255 },
    contentType: { type: String, enum: ['', 'application/pdf', 'image/jpeg', 'image/png'], default: '' },
    size: { type: Number, min: 0, max: 5 * 1024 * 1024, default: 0 },
    content: { type: Buffer, select: false },
    receivedBy: { type: String, required: true, trim: true, maxlength: 100 },
    receivedAt: { type: Date, required: true },
    remarks: { type: String, trim: true, default: '', maxlength: 1000 },
    uploadedBy: { type: String, required: true, maxlength: 100 },
    uploadedAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
    consignmentNumber: { type: String, required: true, unique: true },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        unique: true
    },
    shipmentStatus: { type: String, enum: shipmentStatuses, required: true, default: 'Booked' },
    previousStatus: { type: String, enum: shipmentStatuses, default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
    pod: { type: podSchema, default: null }
}, { timestamps: true, versionKey: false });

shipmentSchema.index({ shipmentStatus: 1, updatedAt: -1 });

const shipmentCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 }
}, { versionKey: false });

const Shipment = mongoose.model('Shipment', shipmentSchema);
const ShipmentCounter = mongoose.model('ShipmentCounter', shipmentCounterSchema);

module.exports = { Shipment, ShipmentCounter, shipmentStatuses };
