const mongoose = require('mongoose');

const tripRoutePlanSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
    routeId: { type: String, required: true, trim: true, maxlength: 100 },
    waypoints: { type: String, trim: true, default: '', maxlength: 5000 },
    plannedStartDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '', maxlength: 2000 },
    createdBy: { type: String, required: true, maxlength: 100 },
    updatedBy: { type: String, required: true, maxlength: 100 }
}, { timestamps: true, versionKey: false });

tripRoutePlanSchema.index({ plannedStartDate: 1, _id: 1 });

module.exports = mongoose.model('TripRoutePlan', tripRoutePlanSchema);
