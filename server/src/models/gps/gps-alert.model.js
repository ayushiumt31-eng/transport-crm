const mongoose = require('mongoose');

const gpsAlertSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FleetVehicle', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'GpsLocation', required: true },
    geofenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'GpsGeofence', default: null },
    type: {
        type: String,
        required: true,
        enum: ['SpeedLimitExceeded', 'GeofenceEntered', 'GeofenceExited']
    },
    message: { type: String, required: true, maxlength: 300 },
    speedKmh: { type: Number, default: null, min: 0 },
    recordedAt: { type: Date, required: true }
}, { timestamps: true, versionKey: false });

gpsAlertSchema.index({ tripId: 1, recordedAt: -1 });
gpsAlertSchema.index({ type: 1, recordedAt: -1 });

module.exports = mongoose.model('GpsAlert', gpsAlertSchema);
