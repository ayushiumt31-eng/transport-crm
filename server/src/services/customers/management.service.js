const mongoose = require('mongoose');
const { Customer } = require('../../models/customers/auth.model');
const CustomerActivity = require('../../models/customers/customer-activity.model');
const KycDocument = require('../../models/customers/kyc-document.model');
const { revokeSessionsFor } = require('../auth/auth.service');
const { isProfileComplete, invalidateKycIfIdentityChanged } = require('./customer-profile.util');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findCustomer(id) {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid customer ID.', 400);
    const customer = await Customer.findById(id);
    if (!customer) throw serviceError('Customer not found.', 404);
    return customer;
}

function publicDocument(document) {
    const value = document.toObject ? document.toObject() : document;
    delete value.content;
    return value;
}

exports.getCustomerSummary = async () => {
    const [summary] = await Customer.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
                pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
                suspended: { $sum: { $cond: [{ $eq: ['$status', 'Suspended'] }, 1, 0] } },
                kycPending: { $sum: { $cond: [{ $eq: ['$kycStatus', 'Pending'] }, 1, 0] } }
            }
        },
        { $project: { _id: 0, total: 1, active: 1, pending: 1, suspended: 1, kycPending: 1 } }
    ]);
    return summary || { total: 0, active: 0, pending: 0, suspended: 0, kycPending: 0 };
};

exports.listCustomers = async ({ page = 1, limit = 10, search, status, kycStatus }) => {
    const filter = {};
    if (status) filter.status = status;
    if (kycStatus) filter.kycStatus = kycStatus;
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        filter.$or = [
            { companyName: pattern },
            { contactPerson: pattern },
            { phone: pattern },
            { email: pattern }
        ];
    }

    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
        Customer.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        Customer.countDocuments(filter)
    ]);
    return {
        customers,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
};

exports.getCustomer = async (id) => (await findCustomer(id)).toObject();

exports.updateCustomerProfile = async (id, changes) => {
    const customer = await findCustomer(id);
    if (changes.phone) {
        const duplicate = await Customer.exists({ phone: changes.phone, _id: { $ne: customer._id } });
        if (duplicate) throw serviceError('Phone number is already in use.', 409);
    }
    if (changes.email) {
        const duplicate = await Customer.exists({ email: changes.email, _id: { $ne: customer._id } });
        if (duplicate) throw serviceError('Email address is already in use.', 409);
    }
    if (changes.gstin) {
        const duplicate = await Customer.exists({ gstin: changes.gstin, _id: { $ne: customer._id } });
        if (duplicate) throw serviceError('GSTIN is already registered.', 409);
    }
    if (changes.pan) {
        const duplicate = await Customer.exists({ pan: changes.pan, _id: { $ne: customer._id } });
        if (duplicate) throw serviceError('PAN is already registered.', 409);
    }

    const identityChanged = invalidateKycIfIdentityChanged(customer, changes);
    if (identityChanged) {
        await KycDocument.updateMany(
            { customerId: customer._id, status: 'Verified' },
            { $set: { status: 'Pending', remarks: '', reviewedAt: null, reviewedBy: '' } }
        );
    }
    customer.set({
        ...changes,
        ...(changes.address ? { address: { ...customer.address.toObject(), ...changes.address } } : {})
    });
    if (changes.email === '') customer.set('email', undefined);
    if (changes.gstin === '') customer.set('gstin', undefined);
    if (changes.pan === '') customer.set('pan', undefined);
    customer.isProfileComplete = isProfileComplete(customer);
    await customer.save();
    return customer.toObject();
};

exports.updateCustomerStatus = async (id, { status, remarks = '' }) => {
    const customer = await findCustomer(id);
    customer.status = status;
    customer.crmStatus = ({ Active: 'Active', Pending: 'Inactive', Suspended: 'Blocked' })[status];
    customer.statusReason = remarks;
    await customer.save();
    if (status === 'Suspended') await revokeSessionsFor('customer', customer._id);
    return customer.toObject();
};

exports.reviewCustomerKyc = async (id, { status, remarks = '' }, actor) => {
    const customer = await findCustomer(id);
    if (customer.kycStatus !== 'Pending') {
        throw serviceError('Only a pending KYC submission can be reviewed.', 409);
    }
    if (status === 'Rejected' && !remarks.trim()) {
        throw serviceError('A reason is required when rejecting KYC.', 400);
    }
    if (status === 'Verified') {
        if (!customer.isProfileComplete || !/^[A-Z]{5}\d{4}[A-Z]$/.test(customer.pan || '')) {
            throw serviceError('The customer profile and PAN must be complete before KYC can be approved.', 409);
        }
        const unverifiedDocuments = await KycDocument.exists({
            customerId: customer._id,
            status: { $ne: 'Verified' }
        });
        if (unverifiedDocuments) {
            throw serviceError('Review all uploaded KYC documents before approving KYC.', 409);
        }
    }

    customer.kycStatus = status;
    customer.crmVerificationStatus = status;
    customer.kycReviewedAt = new Date();
    customer.kycReviewedBy = String(actor.id);
    customer.kycRemarks = remarks;
    await customer.save();
    return customer.toObject();
};

exports.listKycDocuments = async (customerId) => {
    await findCustomer(customerId);
    const documents = await KycDocument.find({ customerId }).sort({ createdAt: -1, _id: -1 }).lean();
    return documents.map(publicDocument);
};

exports.reviewKycDocument = async (customerId, documentId, { status, remarks = '' }, actor) => {
    await findCustomer(customerId);
    if (!mongoose.isValidObjectId(documentId)) throw serviceError('Invalid KYC document ID.', 400);
    const document = await KycDocument.findOne({ _id: documentId, customerId });
    if (!document) throw serviceError('KYC document not found.', 404);
    if (document.status !== 'Pending') throw serviceError('Only pending KYC documents can be reviewed.', 409);
    if (status === 'Rejected' && !remarks.trim()) {
        throw serviceError('A reason is required when rejecting a document.', 400);
    }

    document.status = status;
    document.remarks = remarks;
    document.reviewedAt = new Date();
    document.reviewedBy = String(actor.id);
    await document.save();
    return publicDocument(document);
};

exports.getKycDocumentContent = async (customerId, documentId) => {
    await findCustomer(customerId);
    if (!mongoose.isValidObjectId(documentId)) throw serviceError('Invalid KYC document ID.', 400);
    const document = await KycDocument.findOne({ _id: documentId, customerId }).select('+content').lean();
    if (!document) throw serviceError('KYC document not found.', 404);
    return document;
};

exports.listActivities = async (customerId, limit) => {
    await findCustomer(customerId);
    const activities = await CustomerActivity.find({ customerId }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
    return { activities };
};

exports.createActivity = async (customerId, data, actor) => {
    await findCustomer(customerId);
    if (data.type === 'follow_up' && !data.followUpAt) {
        throw serviceError('A follow-up date and time is required.', 400);
    }
    const activity = await CustomerActivity.create({
        ...data,
        customerId,
        createdBy: String(actor.id)
    });
    return activity.toObject();
};

exports.completeFollowUp = async (customerId, activityId) => {
    await findCustomer(customerId);
    if (!mongoose.isValidObjectId(activityId)) throw serviceError('Invalid activity ID.', 400);
    const activity = await CustomerActivity.findOne({ _id: activityId, customerId });
    if (!activity) throw serviceError('Activity not found.', 404);
    if (activity.type !== 'follow_up') throw serviceError('Only follow-up activities can be completed.', 400);
    if (!activity.followUpCompletedAt) {
        activity.followUpCompletedAt = new Date();
        await activity.save();
    }
    return activity.toObject();
};
