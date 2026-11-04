function isProfileComplete(customer) {
    return Boolean(
        customer.companyName?.trim() &&
        customer.contactPerson?.trim() &&
        customer.email?.trim() &&
        /^[A-Z]{5}\d{4}[A-Z]$/.test(customer.pan || '') &&
        customer.address?.street?.trim() &&
        customer.address?.city?.trim() &&
        customer.address?.state?.trim() &&
        /^\d{6}$/.test(customer.address?.pincode || '')
    );
}

function invalidateKycIfIdentityChanged(customer, changed) {
    const identityFields = ['companyName', 'contactPerson', 'email', 'gstin', 'pan', 'address'];
    const identityChanged = identityFields.some((field) => {
        if (changed[field] === undefined) return false;
        const currentValue = customer[field]?.toObject?.() ?? customer[field];
        if (field === 'address' && changed[field] && typeof changed[field] === 'object') {
            return Object.entries(changed[field]).some(([key, value]) => value !== currentValue?.[key]);
        }
        return changed[field] !== currentValue;
    });

    if (identityChanged && ['Pending', 'Verified', 'Rejected'].includes(customer.kycStatus)) {
        customer.kycStatus = 'NotSubmitted';
        customer.kycSubmittedAt = null;
        customer.kycReviewedAt = null;
        customer.kycReviewedBy = '';
        customer.kycRemarks = '';
        customer.crmVerificationStatus = 'Pending';
    }
    return identityChanged;
}

module.exports = { isProfileComplete, invalidateKycIfIdentityChanged };
