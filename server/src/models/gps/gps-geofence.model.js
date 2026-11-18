const mongoose = require('mongoose');

const gpsGeofenceSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    radiusMeters: { type: Number, required: true, min: 50, max: 100000 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, required: true, maxlength: 100 },
    updatedBy: { type: String, required: true, maxlength: 100 }
}, { timestamps: true, versionKey: false });

gpsGeofenceSchema.index({ isActive: 1, name: 1 });
gpsGeofenceSchema.index({ latitude: 1, longitude: 1 });

const gpsGeofenceStateSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    geofenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'GpsGeofence', required: true },
    isInside: { type: Boolean, required: true },
    updatedAt: { type: Date, required: true, default: Date.now }
}, { versionKey: false });

gpsGeofenceStateSchema.index({ tripId: 1, geofenceId: 1 }, { unique: true });

const GpsGeofence = mongoose.model('GpsGeofence', gpsGeofenceSchema);
const GpsGeofenceState = mongoose.model('GpsGeofenceState', gpsGeofenceStateSchema);

module.exports = { GpsGeofence, GpsGeofenceState };
