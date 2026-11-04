const mongoose = require('mongoose');

// Transport manager profiles. Created by the super admin; their login ID and password live in UserAccount.
const managerSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    branch: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: String, default: '' }
}, { timestamps: true, versionKey: false });

managerSchema.index({ status: 1, createdAt: -1 });

exports.Manager = mongoose.model('Manager', managerSchema);
