const mongoose = require('mongoose');

const maintenanceStatuses = ['Scheduled', 'InProgress', 'Completed', 'Cancelled'];

const maintenanceHistorySchema = new mongoose.Schema({
    status: { type: String, enum: maintenanceStatuses, required: true },
    remarks: { type: String, trim: true, default: '', maxlength: 500 },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const maintenanceRecordSchema = new mongoose.Schema({
    recordNumber: { type: String, required: true, unique: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FleetVehicle', required: true },
    recordType: { type: String, enum: ['Service', 'Repair'], required: true },
    title: { type: String, trim: true, required: true, maxlength: 150 },
    description: { type: String, trim: true, default: '', maxlength: 2000 },
    scheduledAt: { type: Date, required: true },
    dueOdometerKm: { type: Number, default: null, min: 0 },
    vendor: { type: String, trim: true, default: '', maxlength: 150 },
    estimatedCostPaise: { type: Number, default: null, min: 0 },
    actualCostPaise: { type: Number, default: null, min: 0 },
    completedAt: { type: Date, default: null },
    completionOdometerKm: { type: Number, default: null, min: 0 },
    completionRemarks: { type: String, trim: true, default: '', maxlength: 1000 },
    status: { type: String, enum: maintenanceStatuses, required: true, default: 'Scheduled' },
    statusHistory: { type: [maintenanceHistorySchema], default: [] },
    createdBy: { type: String, required: true, maxlength: 100 },
    createdByRole: { type: String, required: true, enum: ['admin', 'manager'] }
}, { timestamps: true, versionKey: false });

maintenanceRecordSchema.index({ vehicleId: 1, scheduledAt: -1, _id: -1 });
maintenanceRecordSchema.index({ status: 1, scheduledAt: 1 });
maintenanceRecordSchema.index({ recordType: 1, status: 1 });

const maintenanceCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 }
}, { versionKey: false });

const MaintenanceRecord = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
const MaintenanceCounter = mongoose.models.MaintenanceCounter
    || mongoose.model('MaintenanceCounter', maintenanceCounterSchema);

module.exports = { MaintenanceRecord, MaintenanceCounter, maintenanceStatuses };
