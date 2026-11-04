const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { UserAccount } = require('../../models/auth/user-account.model');
const { Manager } = require('../../models/auth/manager.model');
const Driver = require('../../models/driver/driver.model');
const { Customer } = require('../../models/customers/auth.model');
const { generateAccessToken } = require('../../utils/jwt.util');

const BCRYPT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const TOKEN_TTL_SECONDS = 86400;
const BAD_CREDENTIALS = 'Incorrect login ID or password.';
// Compared against when the login ID does not exist, so response time doesn't reveal valid IDs.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

// How each role's profile record is loaded, checked and shown to the client.
const profiles = {
    admin: {
        load: async () => ({}),
        assertCanLogin: () => {},
        toUser: (_profile, account) => ({ id: String(account._id), name: 'Super Admin', loginId: account.loginId })
    },
    manager: {
        load: (id) => Manager.findById(id),
        assertCanLogin: (manager) => {
            if (manager.status !== 'Active') throw serviceError('This manager account is inactive. Contact the super admin.', 403);
        },
        toUser: (manager, account) => ({
            id: String(manager._id),
            name: manager.fullName,
            loginId: account.loginId,
            phone: manager.phone,
            branch: manager.branch
        })
    },
    driver: {
        load: (id) => Driver.findOne({ _id: id, isDeleted: false }),
        assertCanLogin: (driver) => {
            if (['Inactive', 'Suspended'].includes(driver.driverStatus)) {
                throw serviceError(`This driver account is ${driver.driverStatus.toLowerCase()}. Contact your transport manager.`, 403);
            }
        },
        toUser: (driver, account) => ({
            id: String(driver._id),
            name: driver.personalInfo?.fullName || '',
            loginId: account.loginId,
            phone: driver.contactInfo?.phone || '',
            driverCode: driver.driverCode
        })
    },
    customer: {
        load: (id) => Customer.findById(id),
        assertCanLogin: (customer) => {
            if (customer.status === 'Suspended') throw serviceError('Your account has been suspended. Please contact support.', 403);
        },
        toUser: (customer, account) => ({
            id: String(customer._id),
            name: customer.contactPerson || customer.companyName || '',
            loginId: account.loginId,
            phone: customer.phone,
            companyName: customer.companyName || '',
            isProfileComplete: customer.isProfileComplete
        })
    }
};

async function loadProfile(account) {
    const config = profiles[account.role];
    const profile = await config.load(account.profileId);
    if (!profile) throw serviceError('This login is no longer linked to an active account.', 403);
    config.assertCanLogin(profile);
    return { profile, user: config.toUser(profile, account) };
}

function issueToken(account) {
    const accessToken = generateAccessToken({
        id: String(account.profileId || account._id),
        role: account.role,
        aid: String(account._id),
        v: account.tokenVersion
    });
    return { accessToken, tokenType: 'Bearer', expiresIn: TOKEN_TTL_SECONDS };
}

exports.login = async (loginId, password) => {
    const account = await UserAccount.findOne({ loginId }).select('+passwordHash');
    if (!account) {
        await bcrypt.compare(password, DUMMY_HASH);
        throw serviceError(BAD_CREDENTIALS, 401);
    }

    const now = new Date();
    if (account.lockedUntil > now) {
        const minutes = Math.ceil((account.lockedUntil - now) / 60000);
        throw serviceError(`Too many incorrect attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, 429);
    }

    if (!await bcrypt.compare(password, account.passwordHash)) {
        account.failedAttempts += 1;
        if (account.failedAttempts >= MAX_FAILED_ATTEMPTS) {
            account.failedAttempts = 0;
            account.lockedUntil = new Date(now.getTime() + LOCKOUT_MS);
        }
        await account.save();
        throw serviceError(BAD_CREDENTIALS, 401);
    }

    if (account.status !== 'Active') throw serviceError('This login has been disabled. Contact your administrator.', 403);
    const { user } = await loadProfile(account);

    account.failedAttempts = 0;
    account.lockedUntil = null;
    account.lastLoginAt = now;
    await account.save();

    return { ...issueToken(account), role: account.role, user };
};

exports.getSession = async (accountId) => {
    const account = await UserAccount.findById(accountId);
    if (!account) throw serviceError('Your session has ended. Please sign in again.', 401);
    const { user } = await loadProfile(account);
    return { role: account.role, user };
};

exports.changePassword = async (accountId, currentPassword, newPassword) => {
    const account = await UserAccount.findById(accountId).select('+passwordHash');
    if (!account) throw serviceError('Your session has ended. Please sign in again.', 401);
    if (!await bcrypt.compare(currentPassword, account.passwordHash)) {
        throw serviceError('Current password is incorrect.', 400);
    }
    if (currentPassword === newPassword) throw serviceError('Choose a password different from the current one.', 400);

    account.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    account.passwordChangedAt = new Date();
    account.tokenVersion += 1; // signs out other devices
    await account.save();
    // A fresh token keeps the current tab signed in.
    return issueToken(account);
};

exports.registerCustomer = async ({ contactPerson, companyName = '', phone, password }) => {
    if (await UserAccount.exists({ loginId: phone })) {
        throw serviceError('A login already exists for this mobile number. Sign in instead.', 409);
    }
    if (await Customer.exists({ phone })) {
        throw serviceError('This mobile number is already registered with us. Ask our team to set up your login.', 409);
    }

    let customer;
    try {
        customer = await Customer.create({ phone, contactPerson, companyName });
        await UserAccount.create({
            loginId: phone,
            passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
            role: 'customer',
            profileId: customer._id,
            createdBy: 'self-registration'
        });
    } catch (error) {
        if (customer) await Customer.deleteOne({ _id: customer._id });
        if (error?.code === 11000) throw serviceError('A login already exists for this mobile number. Sign in instead.', 409);
        throw error;
    }
    return exports.login(phone, password);
};

// ---- Staff-managed logins (manager, driver, customer) ----

const MANAGEABLE_BY = { manager: ['admin'], driver: ['admin', 'manager'], customer: ['admin', 'manager'] };

async function assertCanManage(actor, role, profileId) {
    if (!MANAGEABLE_BY[role]) throw serviceError('Unsupported role.', 400);
    if (!MANAGEABLE_BY[role].includes(actor.role)) {
        throw serviceError('You do not have permission to manage this login.', 403);
    }
    if (!mongoose.isValidObjectId(profileId)) throw serviceError('Invalid record ID.', 400);
    const profile = await profiles[role].load(profileId);
    if (!profile) throw serviceError('Record not found.', 404);
    return profile;
}

const publicAccount = (account) => account && ({
    loginId: account.loginId,
    status: account.status,
    lastLoginAt: account.lastLoginAt,
    passwordChangedAt: account.passwordChangedAt,
    createdAt: account.createdAt
});

exports.getAccountFor = async (actor, role, profileId) => {
    await assertCanManage(actor, role, profileId);
    return publicAccount(await UserAccount.findOne({ role, profileId }));
};

exports.upsertAccountFor = async (actor, role, profileId, { loginId, password, status }) => {
    await assertCanManage(actor, role, profileId);
    let account = await UserAccount.findOne({ role, profileId });

    if (!account && !password) throw serviceError('Set a password to create this login.', 400);
    if (!account) {
        account = new UserAccount({ role, profileId, createdBy: String(actor.id) });
    }

    let revokeSessions = false;
    if (account.loginId !== loginId) account.loginId = loginId;
    if (password) {
        account.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        account.passwordChangedAt = new Date();
        account.failedAttempts = 0;
        account.lockedUntil = null;
        revokeSessions = true;
    }
    if (status && status !== account.status) {
        account.status = status;
        revokeSessions = revokeSessions || status === 'Disabled';
    }
    if (revokeSessions && !account.isNew) account.tokenVersion += 1;

    try {
        await account.save();
    } catch (error) {
        if (error?.code === 11000) throw serviceError('This login ID is already taken. Choose another.', 409);
        throw error;
    }
    return publicAccount(account);
};

// Ends any open sessions for a person (e.g. a manager set to Inactive) without changing their login.
exports.revokeSessionsFor = (role, profileId) =>
    UserAccount.updateOne({ role, profileId }, { $inc: { tokenVersion: 1 } });

exports.deleteAccountFor = (role, profileId) => UserAccount.deleteOne({ role, profileId });

// ---- Super admin bootstrap ----

// Creates the first super admin from ADMIN_LOGIN_ID / ADMIN_PASSWORD when none exists yet.
// After that, the password is changed from the app; the .env value is no longer read.
exports.ensureAdminAccount = async () => {
    if (await UserAccount.exists({ role: 'admin' })) return;

    const loginId = process.env.ADMIN_LOGIN_ID?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!loginId || !password || password.length < 8 || password.startsWith('change-this')) {
        console.warn('No super admin login exists. Set ADMIN_LOGIN_ID and ADMIN_PASSWORD (8+ characters) in server/.env and restart.');
        return;
    }

    await UserAccount.create({
        loginId,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role: 'admin',
        createdBy: 'env-bootstrap'
    });
    console.log(`Created super admin login "${loginId}" from server/.env.`);
};
