const GstProfile = require('../../models/billing/gst-profile.model');

const PROFILE_ID = 'default';

function presentProfile(profile) {
    const taxCategories = (profile?.taxCategories || []).map((category) => ({
        name: category.name,
        serviceCode: category.serviceCode,
        ratePercent: category.taxRateBasisPoints / 100
    }));
    const billingAddress = profile?.billingAddress || {};
    const missingFields = [];
    if (!profile?.legalName) missingFields.push('legalName');
    if (!profile?.gstin) missingFields.push('gstin');
    if (!profile?.registeredState) missingFields.push('registeredState');
    if (!billingAddress.line1) missingFields.push('billingAddress.line1');
    if (!billingAddress.city) missingFields.push('billingAddress.city');
    if (!billingAddress.pincode) missingFields.push('billingAddress.pincode');
    if (!taxCategories.length) missingFields.push('taxCategories');
    if (!profile?.taxRatesReviewed) missingFields.push('taxRatesReviewed');

    return {
        legalName: profile?.legalName || '',
        gstin: profile?.gstin || '',
        registeredState: profile?.registeredState || '',
        billingAddress: {
            line1: billingAddress.line1 || '',
            line2: billingAddress.line2 || '',
            city: billingAddress.city || '',
            pincode: billingAddress.pincode || '',
            country: billingAddress.country || 'India'
        },
        taxCategories,
        taxRatesReviewed: Boolean(profile?.taxRatesReviewed),
        profileComplete: missingFields.length === 0,
        missingFields,
        updatedAt: profile?.updatedAt || null
    };
}

exports.getProfile = async () => {
    const profile = await GstProfile.findById(PROFILE_ID).lean();
    return presentProfile(profile);
};

exports.updateProfile = async (data, actor) => {
    const profile = await GstProfile.findByIdAndUpdate(
        PROFILE_ID,
        {
            $set: {
                legalName: data.legalName,
                gstin: data.gstin,
                registeredState: data.registeredState,
                billingAddress: data.billingAddress,
                taxCategories: data.taxCategories.map((category) => ({
                    name: category.name,
                    serviceCode: category.serviceCode,
                    taxRateBasisPoints: Math.round(category.ratePercent * 100)
                })),
                taxRatesReviewed: data.taxRatesReviewed,
                updatedBy: String(actor.id),
                updatedAt: new Date()
            }
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return presentProfile(profile);
};
