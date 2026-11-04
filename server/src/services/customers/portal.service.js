const mongoose = require('mongoose');
const { Customer } = require('../../models/customers/auth.model');
const KycDocument = require('../../models/customers/kyc-document.model');
const { isProfileComplete, invalidateKycIfIdentityChanged } = require('./customer-profile.util');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
const MIME_SIGNATURES = {
    'application/pdf': (data) => data.subarray(0, 5).toString('ascii') === '%PDF-',
    'image/jpeg': (data) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
    'image/png': (data) => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
};

async function findCustomer(id) {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid customer ID.', 400);
    const customer = await Customer.findById(id);
    if (!customer) throw serviceError('Customer not found.', 404);
    if (customer.status === 'Suspended') throw serviceError('Your account has been suspended. Please contact support.', 403);
    return customer;
}

function publicDocument(document) {
    const value = document.toObject ? document.toObject() : document;
    delete value.content;
    return value;
}

exports.getDashboard = async (customerId) => {
    const customer = await findCustomer(customerId);
    const completedFields = [
        customer.companyName,
        customer.contactPerson,
        customer.email,
        customer.pan,
        customer.address?.street,
        customer.address?.city,
        customer.address?.state,
        customer.address?.pincode
    ].filter((value) => String(value || '').trim()).length;
    return {
        profile: { completionPercent: Math.round((completedFields / 8) * 100) },
        savedAddresses: customer.addresses.length
    };
};

exports.getProfile = async (customerId) => {
    const customer = await findCustomer(customerId);
    customer.lastActiveAt = new Date();
    await customer.save();
    return customer.toObject({ transform: (_doc, value) => {
        delete value.notes;
        delete value.statusReason;
        delete value.crmStatus;
        delete value.crmVerificationStatus;
        delete value.creditLimit;
        delete value.paymentTerms;
        return value;
    } });
};

exports.updateProfile = async (customerId, changes) => {
    const customer = await findCustomer(customerId);
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

exports.getPreferences = async (customerId) => {
    const customer = await findCustomer(customerId);
    return customer.preferences.toObject();
};

exports.updatePreferences = async (customerId, changes) => {
    const customer = await findCustomer(customerId);
    for (const [key, value] of Object.entries(changes)) {
        customer.set(`preferences.${key}`, value);
    }
    await customer.save();
    return customer.preferences.toObject();
};

exports.listAddresses = async (customerId) => {
    const customer = await findCustomer(customerId);
    return customer.addresses;
};

exports.saveAddress = async (customerId, addressId, data) => {
    const customer = await findCustomer(customerId);
    if (addressId && !mongoose.isValidObjectId(addressId)) {
        throw serviceError('Invalid address ID.', 400);
    }

    let address;
    if (addressId) {
        address = customer.addresses.id(addressId);
        if (!address) throw serviceError('Saved address not found.', 404);
        address.set(data);
    } else {
        if (customer.addresses.length >= 25) throw serviceError('You can save at most 25 addresses.', 409);
        customer.addresses.push(data);
        address = customer.addresses[customer.addresses.length - 1];
    }

    if (address.isDefault) {
        customer.addresses.forEach((item) => { item.isDefault = String(item._id) === String(address._id); });
    } else if (customer.addresses.length === 1) {
        address.isDefault = true;
    }
    await customer.save();
    return address.toObject();
};

exports.deleteAddress = async (customerId, addressId) => {
    const customer = await findCustomer(customerId);
    if (!mongoose.isValidObjectId(addressId)) throw serviceError('Invalid address ID.', 400);
    const address = customer.addresses.id(addressId);
    if (!address) throw serviceError('Saved address not found.', 404);
    const wasDefault = address.isDefault;
    address.deleteOne();
    if (wasDefault && customer.addresses.length) customer.addresses[0].isDefault = true;
    await customer.save();
};

exports.submitKyc = async (customerId) => {
    const customer = await findCustomer(customerId);
    customer.isProfileComplete = isProfileComplete(customer);
    if (!customer.isProfileComplete) {
        await customer.save();
        throw serviceError('Complete your profile, including PAN and address, before submitting KYC.', 409);
    }
    if (customer.kycStatus === 'Pending') throw serviceError('Your KYC is already awaiting review.', 409);
    if (customer.kycStatus === 'Verified') throw serviceError('Your KYC is already verified.', 409);
    customer.kycStatus = 'Pending';
    customer.crmVerificationStatus = 'Pending';
    customer.kycSubmittedAt = new Date();
    customer.kycReviewedAt = null;
    customer.kycReviewedBy = '';
    customer.kycRemarks = '';
    await customer.save();
    return customer.toObject();
};

exports.uploadKycDocument = async (customerId, documentType, file) => {
    const customer = await findCustomer(customerId);
    if (!file) throw serviceError('Choose a document file to upload.', 400);
    if (file.size < 1 || file.size > DOCUMENT_MAX_BYTES) {
        throw serviceError('KYC documents must be between 1 byte and 5 MB.', 413);
    }
    const signatureIsValid = MIME_SIGNATURES[file.mimetype]?.(file.buffer);
    if (!signatureIsValid) throw serviceError('Only valid PDF, JPEG or PNG documents are accepted.', 415);

    const originalName = file.originalname
        .replace(/[\\/\u0000-\u001f\u007f"]/g, '_')
        .slice(0, 255);
    const document = await KycDocument.create({
        customerId: customer._id,
        documentType,
        originalName,
        contentType: file.mimetype,
        size: file.size,
        content: file.buffer
    });

    if (customer.kycStatus === 'Verified') {
        customer.kycStatus = 'NotSubmitted';
        customer.kycSubmittedAt = null;
        customer.kycReviewedAt = null;
        customer.kycReviewedBy = '';
        customer.kycRemarks = '';
        customer.crmVerificationStatus = 'Pending';
        await customer.save();
    }
    return publicDocument(document);
};

exports.listKycDocuments = async (customerId) => {
    const customer = await findCustomer(customerId);
    const documents = await KycDocument.find({ customerId: customer._id }).sort({ createdAt: -1, _id: -1 }).lean();
    return documents.map(publicDocument);
};

exports.getKycDocumentContent = async (customerId, documentId) => {
    const customer = await findCustomer(customerId);
    if (!mongoose.isValidObjectId(documentId)) throw serviceError('Invalid KYC document ID.', 400);
    const document = await KycDocument.findOne({ _id: documentId, customerId: customer._id }).select('+content').lean();
    if (!document) throw serviceError('KYC document not found.', 404);
    return document;
};
