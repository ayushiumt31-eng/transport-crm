const mongoose = require('mongoose');

const gpsLocationSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FleetVehicle', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    point: {
        type: { type: String, enum: ['Point'], required: true, default: 'Point' },
        coordinates: { type: [Number], required: true }
    },
    accuracyMeters: { type: Number, required: true, min: 0, max: 1000 },
    speedKmh: { type: Number, default: null, min: 0, max: 300 },
    headingDegrees: { type: Number, default: null, min: 0, max: 360 },
    recordedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true, default: Date.now }
}, { versionKey: false });

gpsLocationSchema.index({ tripId: 1, recordedAt: -1 });
gpsLocationSchema.index({ vehicleId: 1, recordedAt: -1 });
gpsLocationSchema.index({ point: '2dsphere' });
gpsLocationSchema.index({ tripId: 1, recordedAt: 1 }, { unique: true });

module.exports = mongoose.model('GpsLocation', gpsLocationSchema);
