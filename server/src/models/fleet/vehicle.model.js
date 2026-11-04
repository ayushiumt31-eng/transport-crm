const mongoose = require('mongoose');

const vehicleDocumentSchema = new mongoose.Schema({
    documentNumber: { type: String, trim: true, default: '', maxlength: 100 },
    fileUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null }
}, { _id: false });

const documentsSchema = new mongoose.Schema({
    registrationCertificate: { type: vehicleDocumentSchema, default: () => ({}) },
    insurance: { type: vehicleDocumentSchema, default: () => ({}) },
    fitnessCertificate: { type: vehicleDocumentSchema, default: () => ({}) },
    pollutionCertificate: { type: vehicleDocumentSchema, default: () => ({}) },
    nationalPermit: { type: vehicleDocumentSchema, default: () => ({}) }
}, { _id: false });

const vehicleStatusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
        enum: ['Available', 'Allocated', 'OnTrip', 'UnderMaintenance', 'Inactive']
    },
    remarks: { type: String, trim: true, default: '', maxlength: 500 },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager', 'driver'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
    registrationNumber: { type: String, required: true, trim: true, uppercase: true, minlength: 5, maxlength: 20 },
    vehicleType: {
        type: String,
        required: true,
        enum: ['Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other']
    },
    manufacturer: { type: String, required: true, trim: true, maxlength: 100 },
    model: { type: String, required: true, trim: true, maxlength: 100 },
    manufacturingYear: { type: Number, required: true, min: 1950 },
    capacity: {
        value: { type: Number, required: true, min: 0.01, max: 100000 },
        unit: { type: String, required: true, enum: ['Ton', 'KG', 'Litre'] }
    },
    fuelType: { type: String, required: true, enum: ['Diesel', 'Petrol', 'CNG', 'LNG', 'Electric', 'Hybrid', 'Other'] },
    ownershipType: { type: String, enum: ['Owned', 'Leased', 'Attached'], default: 'Owned' },
    color: { type: String, trim: true, default: '', maxlength: 50 },
    chassisNumber: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    engineNumber: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    purchaseDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    documents: { type: documentsSchema, default: () => ({}) },
    vehicleStatus: {
        type: String,
        required: true,
        enum: ['Available', 'Allocated', 'OnTrip', 'UnderMaintenance', 'Inactive'],
        default: 'Available'
    },
    isDeleted: { type: Boolean, default: false },
    statusUpdatedAt: { type: Date, default: Date.now },
    statusHistory: { type: [vehicleStatusHistorySchema], default: [] }
}, { timestamps: true, versionKey: false });

vehicleSchema.index({ registrationNumber: 1 }, { unique: true });
vehicleSchema.index({ vehicleStatus: 1, isDeleted: 1 });
vehicleSchema.index({ vehicleType: 1, vehicleStatus: 1 });

module.exports = mongoose.model('FleetVehicle', vehicleSchema);
