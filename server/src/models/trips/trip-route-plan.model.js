const mongoose = require('mongoose');

const tollSnapshotSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 150 },
    location: { type: String, required: true, maxlength: 200 },
    amountPaise: { type: Number, required: true, min: 0 },
    vehicleTypes: { type: [{ type: String }], default: [] }
}, { _id: false });

const routeSnapshotSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 120 },
    origin: { type: String, required: true, maxlength: 120 },
    destination: { type: String, required: true, maxlength: 120 },
    distanceKm: { type: Number, required: true, min: 0 },
    estimatedDurationMinutes: { type: Number, required: true, min: 1 },
    tolls: { type: [tollSnapshotSchema], default: [] }
}, { _id: false });

const tripRoutePlanSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
    routeCatalogId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
    routeId: { type: String, required: true, trim: true, maxlength: 100 },
    waypoints: { type: String, trim: true, default: '', maxlength: 5000 },
    distanceKm: { type: Number, default: null, min: 0 },
    estimatedDurationMinutes: { type: Number, default: null, min: 1 },
    estimatedTollPaise: { type: Number, default: null, min: 0 },
    routeSnapshot: { type: routeSnapshotSchema, default: null },
    plannedStartDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '', maxlength: 2000 },
    createdBy: { type: String, required: true, maxlength: 100 },
    updatedBy: { type: String, required: true, maxlength: 100 }
}, { timestamps: true, versionKey: false });

tripRoutePlanSchema.index({ plannedStartDate: 1, _id: 1 });

module.exports = mongoose.model('TripRoutePlan', tripRoutePlanSchema);
