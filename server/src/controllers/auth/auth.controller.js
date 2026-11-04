const authService = require('../../services/auth/auth.service');

const handle = (work, status = 200) => async (req, res, next) => {
    try {
        const { message, ...data } = await work(req);
        return res.status(status).json({ success: true, ...(message ? { message } : {}), data });
    } catch (error) {
        return next(error);
    }
};

exports.login = handle((req) => authService.login(req.body.loginId, req.body.password));

exports.register = handle((req) => authService.registerCustomer(req.body), 201);

exports.getSession = handle((req) => authService.getSession(req.user.accountId));

exports.changePassword = handle(async (req) => ({
    message: 'Password changed. Other devices have been signed out.',
    ...await authService.changePassword(req.user.accountId, req.body.currentPassword, req.body.newPassword)
}));

exports.getAccount = handle(async (req) => ({
    account: await authService.getAccountFor(req.user, req.params.role, req.params.profileId)
}));

exports.upsertAccount = handle(async (req) => ({
    message: 'Login saved.',
    account: await authService.upsertAccountFor(req.user, req.params.role, req.params.profileId, req.body)
}));
