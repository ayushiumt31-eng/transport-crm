const mongoose = require('mongoose');

const customerActivitySchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['note', 'call', 'email', 'sms', 'follow_up'],
        required: true
    },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: '', maxlength: 2000 },
    followUpAt: { type: Date, default: null },
    followUpCompletedAt: { type: Date, default: null },
    createdBy: { type: String, required: true, maxlength: 100 }
}, { timestamps: true, versionKey: false });

customerActivitySchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerActivity', customerActivitySchema);
