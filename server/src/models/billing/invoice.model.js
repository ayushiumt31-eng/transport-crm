const mongoose = require('mongoose');

const invoiceStatuses = ['Issued', 'PartiallyPaid', 'Paid', 'Cancelled'];

const invoiceLineSchema = new mongoose.Schema({
    description: { type: String, required: true, trim: true, maxlength: 200 },
    quantityMilli: { type: Number, required: true, min: 1 },
    unitPricePaise: { type: Number, required: true, min: 0 },
    lineTotalPaise: { type: Number, required: true, min: 0 }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
    receiptNumber: { type: String, required: true },
    idempotencyKey: { type: String, required: true, maxlength: 128 },
    amountPaise: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ['BankTransfer', 'UPI', 'Card', 'Cash', 'Cheque', 'Other'], required: true },
    transactionReference: { type: String, trim: true, default: '', maxlength: 100 },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
    paidAt: { type: Date, required: true },
    recordedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: true });

const invoiceHistorySchema = new mongoose.Schema({
    action: { type: String, enum: ['Issued', 'PaymentRecorded', 'Cancelled'], required: true },
    remarks: { type: String, trim: true, default: '', maxlength: 500 },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    shipmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shipment',
        required: true,
        unique: true
    },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerSnapshot: {
        name: { type: String, required: true, maxlength: 150 },
        companyName: { type: String, trim: true, default: '', maxlength: 150 },
        phone: { type: String, required: true, maxlength: 20 },
        email: { type: String, trim: true, default: '', maxlength: 254 },
        gstin: { type: String, trim: true, default: '', maxlength: 15 },
        billingAddress: {
            street: { type: String, trim: true, default: '', maxlength: 200 },
            city: { type: String, trim: true, default: '', maxlength: 100 },
            state: { type: String, trim: true, default: '', maxlength: 100 },
            pincode: { type: String, trim: true, default: '', maxlength: 6 },
            country: { type: String, trim: true, default: 'India', maxlength: 80 }
        }
    },
    bookingNumber: { type: String, required: true, maxlength: 32 },
    consignmentNumber: { type: String, required: true, maxlength: 32 },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    currency: { type: String, enum: ['INR'], required: true, default: 'INR' },
    items: { type: [invoiceLineSchema], required: true, validate: [(items) => items.length > 0 && items.length <= 50, 'An invoice must have between 1 and 50 line items.'] },
    subtotalPaise: { type: Number, required: true, min: 1 },
    taxRateBasisPoints: { type: Number, required: true, min: 0, max: 10000, default: 0 },
    taxPaise: { type: Number, required: true, min: 0, default: 0 },
    totalPaise: { type: Number, required: true, min: 1 },
    amountPaidPaise: { type: Number, required: true, min: 0, default: 0 },
    invoiceStatus: { type: String, enum: invoiceStatuses, required: true, default: 'Issued' },
    payments: {
        type: [paymentSchema],
        default: [],
        validate: [(payments) => payments.length <= 100, 'An invoice cannot contain more than 100 payment receipts.']
    },
    statusHistory: { type: [invoiceHistorySchema], default: [] }
}, { timestamps: true, versionKey: false });

invoiceSchema.index({ customerId: 1, invoiceDate: -1, _id: -1 });
invoiceSchema.index({ invoiceStatus: 1, dueDate: 1 });
invoiceSchema.index({ bookingId: 1, invoiceDate: -1 });

const invoiceCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 }
}, { versionKey: false });

const Invoice = mongoose.model('Invoice', invoiceSchema);
const InvoiceCounter = mongoose.model('InvoiceCounter', invoiceCounterSchema);

module.exports = { Invoice, InvoiceCounter, invoiceStatuses };
