const mongoose = require('mongoose');

const feedbackStatuses = ['Open', 'InReview', 'Resolved'];
const feedbackCategories = ['Service', 'Driver', 'Vehicle', 'Delivery', 'Other'];

const historySchema = new mongoose.Schema({
    status: { type: String, enum: feedbackStatuses, required: true },
    remarks: { type: String, trim: true, default: '', maxlength: 2000 },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, enum: ['customer', 'admin', 'manager'], required: true },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
    shipmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shipment',
        required: true,
        unique: true
    },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    bookingNumber: { type: String, required: true, maxlength: 32 },
    consignmentNumber: { type: String, required: true, maxlength: 32 },
    category: { type: String, enum: feedbackCategories, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: feedbackStatuses, required: true, default: 'Open' },
    staffResponse: { type: String, trim: true, default: '', maxlength: 2000 },
    statusHistory: { type: [historySchema], default: [] }
}, { timestamps: true, versionKey: false });

feedbackSchema.index({ customerId: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerFeedback', feedbackSchema);
module.exports.feedbackStatuses = feedbackStatuses;
module.exports.feedbackCategories = feedbackCategories;
