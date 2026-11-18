const mongoose = require('mongoose');

const gstTaxCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    serviceCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 8 },
    taxRateBasisPoints: { type: Number, required: true, min: 0, max: 10000 }
}, { _id: false });

const gstProfileSchema = new mongoose.Schema({
    _id: { type: String, default: 'default' },
    legalName: { type: String, trim: true, default: '', maxlength: 150 },
    gstin: { type: String, trim: true, uppercase: true, default: '', maxlength: 15 },
    registeredState: { type: String, trim: true, default: '', maxlength: 100 },
    billingAddress: {
        line1: { type: String, trim: true, default: '', maxlength: 200 },
        line2: { type: String, trim: true, default: '', maxlength: 200 },
        city: { type: String, trim: true, default: '', maxlength: 100 },
        pincode: { type: String, trim: true, default: '', maxlength: 10 },
        country: { type: String, trim: true, default: 'India', maxlength: 80 }
    },
    taxCategories: {
        type: [gstTaxCategorySchema],
        default: [],
        validate: [(categories) => categories.length <= 50, 'A GST profile cannot contain more than 50 tax categories.']
    },
    taxRatesReviewed: { type: Boolean, default: false },
    updatedBy: { type: String, default: '', maxlength: 100 },
    updatedAt: { type: Date, default: null }
}, { versionKey: false });

module.exports = mongoose.model('GstProfile', gstProfileSchema);
