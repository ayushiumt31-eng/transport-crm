const mongoose = require('mongoose');

const driverPaymentLockSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    lockedUntil: { type: Date, required: true, default: new Date(0) }
}, { versionKey: false });

module.exports = mongoose.model('DriverPaymentLock', driverPaymentLockSchema);
