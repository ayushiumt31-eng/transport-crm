const mongoose = require('mongoose');

const routeTollSchema = new mongoose.Schema({
    name: { type: String, trim: true, required: true, maxlength: 150 },
    location: { type: String, trim: true, required: true, maxlength: 200 },
    amountPaise: { type: Number, required: true, min: 0 },
    vehicleTypes: {
        type: [{ type: String, enum: ['Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other'] }],
        default: []
    },
    notes: { type: String, trim: true, default: '', maxlength: 500 }
}, { _id: true });

const routeHistorySchema = new mongoose.Schema({
    action: { type: String, enum: ['Created', 'Updated', 'Archived'], required: true },
    remarks: { type: String, trim: true, default: '', maxlength: 500 },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const routeSchema = new mongoose.Schema({
    routeNumber: { type: String, required: true, unique: true },
    name: { type: String, trim: true, required: true, maxlength: 120 },
    origin: { type: String, trim: true, required: true, maxlength: 120 },
    destination: { type: String, trim: true, required: true, maxlength: 120 },
    distanceKm: { type: Number, required: true, min: 0.1, max: 100000 },
    estimatedDurationMinutes: { type: Number, required: true, min: 1, max: 1000000 },
    waypoints: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
    tolls: {
        type: [routeTollSchema],
        default: [],
        validate: [(tolls) => tolls.length <= 100, 'A route cannot contain more than 100 toll plazas.']
    },
    notes: { type: String, trim: true, default: '', maxlength: 2000 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    routeHistory: { type: [routeHistorySchema], default: [] },
    createdBy: { type: String, required: true, maxlength: 100 },
    updatedBy: { type: String, required: true, maxlength: 100 }
}, { timestamps: true, versionKey: false });

routeSchema.index({ isActive: 1, isDeleted: 1, origin: 1, destination: 1 });
routeSchema.index({ origin: 1, destination: 1, distanceKm: 1 });

const routeCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 }
}, { versionKey: false });

const Route = mongoose.model('Route', routeSchema);
const RouteCounter = mongoose.models.RouteCounter || mongoose.model('RouteCounter', routeCounterSchema);

module.exports = { Route, RouteCounter };
