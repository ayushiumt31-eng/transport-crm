const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipientAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserAccount',
        required: true
    },
    eventKey: { type: String, required: true, maxlength: 180 },
    category: { type: String, required: true, enum: ['trip', 'gps'] },
    eventType: { type: String, required: true, maxlength: 80 },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
    tripNumber: { type: String, trim: true, default: '', maxlength: 40 },
    readAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

notificationSchema.index({ recipientAccountId: 1, createdAt: -1 });
notificationSchema.index({ recipientAccountId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ eventKey: 1, recipientAccountId: 1 }, { unique: true });

module.exports = mongoose.model('Notification', notificationSchema);
