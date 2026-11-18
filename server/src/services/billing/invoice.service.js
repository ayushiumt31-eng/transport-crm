const mongoose = require('mongoose');
const { Booking } = require('../../models/bookings/booking.model');
const { Shipment } = require('../../models/cargo/shipment.model');
const { Customer } = require('../../models/customers/auth.model');
const { Trip } = require('../../models/trips/trip.model');
const { Invoice, InvoiceCounter } = require('../../models/billing/invoice.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const STAFF_ROLES = ['admin', 'manager'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function utcDayStart(value) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return date;
}

function utcDayEnd(value) {
    const date = new Date(`${value}T23:59:59.999Z`);
    return date;
}

function dateFilter(query, field) {
    const range = {};
    if (query.startDate) range.$gte = utcDayStart(query.startDate);
    if (query.endDate) range.$lte = utcDayEnd(query.endDate);
    return Object.keys(range).length ? { [field]: range } : {};
}

function actorInvoiceFilter(actor) {
    if (STAFF_ROLES.includes(actor.role)) return {};
    if (actor.role === 'customer' && mongoose.isValidObjectId(actor.id)) {
        return { customerId: new mongoose.Types.ObjectId(actor.id) };
    }
    throw serviceError('You do not have permission to access billing records.', 403);
}

function effectiveStatus(invoice, now = new Date()) {
    if (['Issued', 'PartiallyPaid'].includes(invoice.invoiceStatus) && invoice.amountPaidPaise < invoice.totalPaise && invoice.dueDate < now) {
        return 'Overdue';
    }
    return invoice.invoiceStatus;
}

function publicInvoice(invoice) {
    return {
        ...invoice,
        payments: (invoice.payments || []).map((payment) => ({
            _id: payment._id,
            receiptNumber: payment.receiptNumber,
            amountPaise: payment.amountPaise,
            method: payment.method,
            transactionReference: payment.transactionReference,
            notes: payment.notes,
            paidAt: payment.paidAt,
            createdAt: payment.createdAt
        })),
        statusHistory: (invoice.statusHistory || []).map((entry) => ({
            action: entry.action,
            remarks: entry.remarks,
            createdAt: entry.createdAt
        })),
        invoiceStatus: effectiveStatus(invoice)
    };
}

function actorHistory(action, actor, remarks = '') {
    return {
        action,
        remarks,
        updatedBy: String(actor.id),
        role: actor.role,
        createdAt: new Date()
    };
}

function toPaise(amount) {
    const paise = Math.round(amount * 100);
    if (!Number.isSafeInteger(paise)) throw serviceError('The amount is outside the supported range.', 400);
    return paise;
}

function roundedProductRatio(left, right, denominator) {
    const numerator = BigInt(left) * BigInt(right);
    const result = Number((numerator + BigInt(denominator) / 2n) / BigInt(denominator));
    if (!Number.isSafeInteger(result)) throw serviceError('An invoice total is outside the supported range.', 400);
    return result;
}

async function nextInvoiceNumber(counterModel, prefix) {
    const year = new Date().getUTCFullYear();
    const counterId = `${prefix}-${year}`;
    let counter;
    try {
        counter = await counterModel.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        if (error?.code !== 11000) throw error;
        counter = await counterModel.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true }
        );
    }
    return `${prefix === 'invoice' ? 'INV' : 'RC'}-${year}-${String(counter.value).padStart(6, '0')}`;
}

function invoiceFilter(query, actor) {
    const filter = { ...actorInvoiceFilter(actor), ...dateFilter(query, 'invoiceDate') };
    const now = new Date();
    if (query.status === 'Overdue') {
        filter.invoiceStatus = { $in: ['Issued', 'PartiallyPaid'] };
        filter.dueDate = { $lt: now };
        filter.$expr = { $lt: ['$amountPaidPaise', '$totalPaise'] };
    } else if (query.status) {
        filter.invoiceStatus = query.status;
        if (['Issued', 'PartiallyPaid'].includes(query.status)) {
            filter.dueDate = { $gte: now };
        }
    }
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [
            { invoiceNumber: pattern },
            { bookingNumber: pattern },
            { consignmentNumber: pattern },
            { 'customerSnapshot.name': pattern },
            { 'customerSnapshot.companyName': pattern }
        ];
    }
    return filter;
}

exports.listInvoiceOptions = async ({ page, limit }) => {
    const invoicedShipmentIds = await Invoice.distinct('shipmentId');
    const filter = {
        shipmentStatus: 'Delivered',
        pod: { $ne: null },
        _id: { $nin: invoicedShipmentIds }
    };
    const skip = (page - 1) * limit;
    const [shipments, total] = await Promise.all([
        Shipment.find(filter)
            .populate({
                path: 'bookingId',
                select: 'bookingNumber customerId pickupAddress deliveryAddress cargo schedule quote',
                populate: { path: 'customerId', select: 'contactPerson companyName phone' }
            })
            .sort({ updatedAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Shipment.countDocuments(filter)
    ]);
    return {
        data: shipments.filter((shipment) => shipment.bookingId).map((shipment) => ({
            _id: shipment._id,
            consignmentNumber: shipment.consignmentNumber,
            booking: shipment.bookingId,
            deliveredAt: shipment.statusHistory.filter((item) => item.status === 'Delivered').at(-1)?.createdAt || shipment.updatedAt
        })),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
};

exports.createInvoice = async (data, actor) => {
    if (!mongoose.isValidObjectId(data.shipmentId)) throw serviceError('Invalid shipment ID.', 400);
    const shipment = await Shipment.findById(data.shipmentId).lean();
    if (!shipment) throw serviceError('Shipment not found.', 404);
    if (shipment.shipmentStatus !== 'Delivered' || !shipment.pod) {
        throw serviceError('Only a delivered shipment with proof of delivery can be invoiced.', 409);
    }
    const booking = await Booking.findById(shipment.bookingId).lean();
    if (!booking) throw serviceError('The shipment booking no longer exists.', 409);
    const completedTrip = await Trip.exists({ bookingId: booking._id, tripStatus: 'Completed' });
    if (!completedTrip) throw serviceError('Complete the linked trip before invoicing the shipment.', 409);
    const customer = await Customer.findById(booking.customerId)
        .select('contactPerson companyName phone email gstin address status')
        .lean();
    if (!customer) throw serviceError('The booking customer no longer exists.', 409);

    const invoiceDate = utcDayStart(data.invoiceDate);
    const dueDate = utcDayEnd(data.dueDate);
    if (dueDate < invoiceDate) throw serviceError('Due date must be on or after the invoice date.', 400);

    const acceptedQuote = booking.quote?.status === 'Accepted' ? booking.quote : null;
    if (acceptedQuote && data.taxRatePercent !== 0) {
        throw serviceError('An accepted booking quote already fixes the payable amount; invoice tax adjustments are not available in this internal billing workflow.', 409);
    }
    const items = acceptedQuote
        ? acceptedQuote.items.map((item) => ({
            description: item.description,
            quantityMilli: item.quantityMilli,
            unitPricePaise: item.unitPricePaise,
            lineTotalPaise: item.lineTotalPaise
        }))
        : data.items.map((item) => {
            const quantityMilli = Math.round(item.quantity * 1000);
            const unitPricePaise = toPaise(item.unitPrice);
            const lineTotalPaise = roundedProductRatio(quantityMilli, unitPricePaise, 1000);
            return { description: item.description, quantityMilli, unitPricePaise, lineTotalPaise };
        });
    const subtotalPaise = items.reduce((total, item) => total + item.lineTotalPaise, 0);
    const taxRateBasisPoints = acceptedQuote ? 0 : Math.round(data.taxRatePercent * 100);
    if (!Number.isSafeInteger(subtotalPaise)) throw serviceError('Invoice subtotal is outside the supported range.', 400);
    const taxPaise = roundedProductRatio(subtotalPaise, taxRateBasisPoints, 10000);
    const totalPaise = subtotalPaise + taxPaise;
    if (![subtotalPaise, taxPaise, totalPaise].every(Number.isSafeInteger) || subtotalPaise <= 0) {
        throw serviceError('Invoice totals are outside the supported range.', 400);
    }

    const customerAddress = booking.deliveryAddress || {};
    const customerSnapshot = {
        name: customer.contactPerson || customer.companyName || 'Customer',
        companyName: customer.companyName || '',
        phone: customer.phone,
        email: customer.email || '',
        gstin: customer.gstin || '',
        billingAddress: {
            street: customerAddress.street || customer.address?.street || '',
            city: customerAddress.city || customer.address?.city || '',
            state: customerAddress.state || customer.address?.state || '',
            pincode: customerAddress.pincode || customer.address?.pincode || '',
            country: customerAddress.country || 'India'
        }
    };

    try {
        const invoice = await Invoice.create({
            invoiceNumber: await nextInvoiceNumber(InvoiceCounter, 'invoice'),
            shipmentId: shipment._id,
            bookingId: booking._id,
            customerId: customer._id,
            customerSnapshot,
            bookingNumber: booking.bookingNumber,
            consignmentNumber: shipment.consignmentNumber,
            invoiceDate,
            dueDate,
            items,
            subtotalPaise,
            taxRateBasisPoints,
            taxPaise,
            totalPaise,
            amountPaidPaise: 0,
            invoiceStatus: 'Issued',
            statusHistory: [actorHistory(
                'Issued',
                actor,
                acceptedQuote
                    ? `Invoice issued for delivered shipment with proof of delivery, matching accepted booking quote v${acceptedQuote.version}.`
                    : 'Invoice issued for a delivered shipment with proof of delivery.'
            )]
        });
        return publicInvoice(invoice.toObject());
    } catch (error) {
        if (error?.code === 11000) throw serviceError('An invoice already exists for this shipment, or the invoice number was already used.', 409);
        throw error;
    }
};

exports.listInvoices = async (query, actor) => {
    const filter = invoiceFilter(query, actor);
    const skip = (query.page - 1) * query.limit;
    const [invoices, total] = await Promise.all([
        Invoice.find(filter).sort({ invoiceDate: -1, _id: -1 }).skip(skip).limit(query.limit).lean(),
        Invoice.countDocuments(filter)
    ]);
    return {
        data: invoices.map(publicInvoice),
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.getInvoice = async (id, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid invoice ID.', 400);
    const invoice = await Invoice.findOne({ ...actorInvoiceFilter(actor), _id: id }).lean();
    if (!invoice) throw serviceError('Invoice not found.', 404);
    return publicInvoice(invoice);
};

exports.recordPayment = async (id, data, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid invoice ID.', 400);
    const amountPaise = toPaise(data.amount);
    if (amountPaise < 1) throw serviceError('Payment must be at least ₹0.01.', 400);

    let invoice = await Invoice.findById(id).lean();
    if (!invoice) throw serviceError('Invoice not found.', 404);
    const existing = invoice.payments.find((payment) => payment.idempotencyKey === data.idempotencyKey);
    if (existing) {
        const samePayment = existing.amountPaise === amountPaise
            && existing.method === data.method
            && existing.transactionReference === data.transactionReference;
        if (!samePayment) throw serviceError('This payment idempotency key was already used with different details.', 409);
        return { invoice: publicInvoice(invoice), created: false };
    }
    if (invoice.invoiceStatus === 'Cancelled') throw serviceError('A cancelled invoice cannot receive payments.', 409);
    if (invoice.invoiceStatus === 'Paid' || invoice.amountPaidPaise >= invoice.totalPaise) {
        throw serviceError('This invoice is already fully paid.', 409);
    }
    if (invoice.payments.length >= 100) throw serviceError('This invoice has reached its payment receipt limit.', 409);
    const nextPaidPaise = invoice.amountPaidPaise + amountPaise;
    if (nextPaidPaise > invoice.totalPaise) {
        throw serviceError('Payment exceeds the invoice outstanding balance.', 409);
    }

    const payment = {
        receiptNumber: await nextInvoiceNumber(InvoiceCounter, 'receipt'),
        idempotencyKey: data.idempotencyKey,
        amountPaise,
        method: data.method,
        transactionReference: data.transactionReference,
        notes: data.notes,
        paidAt: data.paidAt,
        recordedBy: String(actor.id),
        role: actor.role,
        createdAt: new Date()
    };
    const nextStatus = nextPaidPaise === invoice.totalPaise ? 'Paid' : 'PartiallyPaid';
    const updated = await Invoice.findOneAndUpdate(
        {
            _id: invoice._id,
            amountPaidPaise: invoice.amountPaidPaise,
            invoiceStatus: { $in: ['Issued', 'PartiallyPaid'] },
            payments: { $not: { $elemMatch: { idempotencyKey: data.idempotencyKey } } },
            $expr: { $lte: [{ $add: ['$amountPaidPaise', amountPaise] }, '$totalPaise'] }
        },
        {
            $set: { amountPaidPaise: nextPaidPaise, invoiceStatus: nextStatus },
            $push: {
                payments: payment,
                statusHistory: actorHistory('PaymentRecorded', actor, `Receipt ${payment.receiptNumber} recorded.`)
            }
        },
        { new: true, runValidators: true }
    ).lean();
    if (updated) return { invoice: publicInvoice(updated), created: true };

    invoice = await Invoice.findById(id).lean();
    if (!invoice) throw serviceError('Invoice not found.', 404);
    const retry = invoice.payments.find((entry) => entry.idempotencyKey === data.idempotencyKey);
    if (retry
        && retry.amountPaise === amountPaise
        && retry.method === data.method
        && retry.transactionReference === data.transactionReference) {
        return { invoice: publicInvoice(invoice), created: false };
    }
    if (retry) throw serviceError('This payment idempotency key was already used with different details.', 409);
    throw serviceError('Invoice balance changed or payment exceeds the outstanding amount. Refresh and retry.', 409);
};

exports.listPayments = async (query, actor) => {
    const stages = [
        { $match: actorInvoiceFilter(actor) },
        { $unwind: '$payments' },
        ...(Object.keys(dateFilter(query, 'payments.paidAt')).length ? [{ $match: dateFilter(query, 'payments.paidAt') }] : []),
        ...(query.search ? [{
            $match: {
                $or: [
                    { 'payments.receiptNumber': new RegExp(escapeRegex(query.search), 'i') },
                    { invoiceNumber: new RegExp(escapeRegex(query.search), 'i') },
                    { bookingNumber: new RegExp(escapeRegex(query.search), 'i') },
                    { consignmentNumber: new RegExp(escapeRegex(query.search), 'i') },
                    { 'payments.transactionReference': new RegExp(escapeRegex(query.search), 'i') },
                    { 'customerSnapshot.name': new RegExp(escapeRegex(query.search), 'i') },
                    { 'customerSnapshot.companyName': new RegExp(escapeRegex(query.search), 'i') }
                ]
            }
        }] : []),
        {
            $facet: {
                data: [
                    { $sort: { 'payments.paidAt': -1, 'payments._id': -1 } },
                    { $skip: (query.page - 1) * query.limit },
                    { $limit: query.limit },
                    {
                        $project: {
                            _id: '$payments._id',
                            receiptNumber: '$payments.receiptNumber',
                            amountPaise: '$payments.amountPaise',
                            method: '$payments.method',
                            transactionReference: '$payments.transactionReference',
                            notes: '$payments.notes',
                            paidAt: '$payments.paidAt',
                            invoiceId: '$_id',
                            invoiceNumber: 1,
                            bookingNumber: 1,
                            consignmentNumber: 1,
                            customerId: 1,
                            customerName: {
                                $cond: [
                                    { $ne: ['$customerSnapshot.companyName', ''] },
                                    '$customerSnapshot.companyName',
                                    '$customerSnapshot.name'
                                ]
                            }
                        }
                    }
                ],
                pagination: [{ $count: 'total' }]
            }
        }
    ];
    const [result] = await Invoice.aggregate(stages);
    const total = result?.pagination[0]?.total || 0;
    return {
        data: result?.data || [],
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.cancelInvoice = async (id, { remarks }, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid invoice ID.', 400);
    const updated = await Invoice.findOneAndUpdate(
        { _id: id, invoiceStatus: 'Issued', amountPaidPaise: 0, payments: { $size: 0 } },
        {
            $set: { invoiceStatus: 'Cancelled' },
            $push: { statusHistory: actorHistory('Cancelled', actor, remarks) }
        },
        { new: true, runValidators: true }
    ).lean();
    if (!updated) {
        const invoice = await Invoice.findById(id).select('_id').lean();
        if (!invoice) throw serviceError('Invoice not found.', 404);
        throw serviceError('Only an unpaid, unadjusted Issued invoice can be cancelled.', 409);
    }
    return publicInvoice(updated);
};

exports.getFinancialSummary = async (query) => {
    const period = dateFilter(query, 'invoiceDate');
    const paymentPeriod = dateFilter(query, 'payments.paidAt');
    const [invoiceTotals, paymentTotals, outstandingRows, overdueCount] = await Promise.all([
        Invoice.aggregate([
            { $match: { ...period, invoiceStatus: { $ne: 'Cancelled' } } },
            { $group: { _id: null, invoiceCount: { $sum: 1 }, billedPaise: { $sum: '$totalPaise' } } }
        ]),
        Invoice.aggregate([
            { $unwind: '$payments' },
            { $match: paymentPeriod },
            { $group: { _id: null, collectedPaise: { $sum: '$payments.amountPaise' } } }
        ]),
        Invoice.aggregate([
            { $match: { invoiceStatus: { $in: ['Issued', 'PartiallyPaid'] } } },
            { $group: { _id: null, outstandingPaise: { $sum: { $subtract: ['$totalPaise', '$amountPaidPaise'] } } } }
        ]),
        Invoice.countDocuments({
            invoiceStatus: { $in: ['Issued', 'PartiallyPaid'] },
            dueDate: { $lt: new Date() },
            $expr: { $lt: ['$amountPaidPaise', '$totalPaise'] }
        })
    ]);
    return {
        period: { startDate: query.startDate || null, endDate: query.endDate || null },
        invoiceCount: invoiceTotals[0]?.invoiceCount || 0,
        billedPaise: invoiceTotals[0]?.billedPaise || 0,
        collectedPaise: paymentTotals[0]?.collectedPaise || 0,
        outstandingPaise: outstandingRows[0]?.outstandingPaise || 0,
        overdueInvoices: overdueCount,
        currency: 'INR'
    };
};
