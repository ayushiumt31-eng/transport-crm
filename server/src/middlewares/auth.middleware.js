const mongoose = require('mongoose');
const { UserAccount } = require('../models/auth/user-account.model');
const { verifyAccessToken: verifyJwt } = require('../utils/jwt.util');

const STAFF_ROLES = ['admin', 'manager'];

function unauthorized(response) {
    return response.status(401).json({
        success: false,
        message: 'Your session has ended. Please sign in again.'
    });
}

async function verifyAccessToken(request, response, next) {
    const authorization = request.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) return unauthorized(response);

    let payload;
    try {
        payload = verifyJwt(token);
    } catch (error) {
        if (error.statusCode === 503) return next(error);
        return unauthorized(response);
    }

    if (
        !mongoose.isValidObjectId(payload.aid) ||
        typeof payload.role !== 'string' ||
        !Number.isInteger(payload.v)
    ) {
        return unauthorized(response);
    }

    try {
        const account = await UserAccount.findById(payload.aid)
            .select('_id role profileId status tokenVersion')
            .lean();

        if (
            !account ||
            account.status !== 'Active' ||
            account.role !== payload.role ||
            account.tokenVersion !== payload.v
        ) {
            return unauthorized(response);
        }

        request.user = {
            id: String(account.profileId || account._id),
            accountId: String(account._id),
            role: account.role
        };
        return next();
    } catch (error) {
        return next(error);
    }
}

function requireRole(...roles) {
    return (request, response, next) => {
        if (!request.user) return unauthorized(response);
        if (!roles.includes(request.user.role)) {
            return response.status(403).json({
                success: false,
                message: 'You do not have permission to access this resource.'
            });
        }
        return next();
    };
}

module.exports = { verifyAccessToken, requireRole, STAFF_ROLES };
