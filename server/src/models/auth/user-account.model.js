const mongoose = require('mongoose');

// Login credentials for every role. All roles sign in on one page with a login ID and password;
// the role decides which panel opens. `profileId` points at the Manager / Driver / Customer record
// (the super admin has no profile record, so it is null for that role).
const userAccountSchema = new mongoose.Schema({
    loginId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ['admin', 'manager', 'driver', 'customer'] },
    profileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' },
    // Bumped when the password changes or access is disabled, so older tokens stop working.
    tokenVersion: { type: Number, default: 0 },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    createdBy: { type: String, default: '' }
}, { timestamps: true, versionKey: false });

// One login per person.
userAccountSchema.index(
    { role: 1, profileId: 1 },
    { unique: true, partialFilterExpression: { profileId: { $type: 'objectId' } } }
);

exports.UserAccount = mongoose.model('UserAccount', userAccountSchema);
