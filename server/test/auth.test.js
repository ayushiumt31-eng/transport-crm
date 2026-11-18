const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, test } = require('node:test');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.ADMIN_LOGIN_ID = `auth-test-admin-${process.pid}`;
process.env.ADMIN_PASSWORD = 'Auth-Test-Password-123!';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET ||= 'auth-test-access-secret-0123456789-abcdefgh';
process.env.JWT_REFRESH_SECRET ||= 'auth-test-refresh-secret-9876543210-hgfedcba';
process.env.GPS_SPEED_ALERT_LIMIT_KMH = '80';

const { Manager } = require('../src/models/auth/manager.model');
const { UserAccount } = require('../src/models/auth/user-account.model');
const { Booking } = require('../src/models/bookings/booking.model');
const { Customer } = require('../src/models/customers/auth.model');
const Driver = require('../src/models/driver/driver.model');
const Notification = require('../src/models/notifications/notification.model');
const { startServer } = require('../src');

let server;
let baseUrl;
let customerPhone;
let customerToken;
let otherCustomerToken;
let customerId;
let adminToken;
let confirmedBooking;
let pendingBooking;
let manager;
let managerToken;
let driver;
let driverToken;
let registrationNumber = 0;

const testUri = (() => {
    const configuredUri = process.env.AUTH_TEST_MONGODB_URI || process.env.MONGODB_URI;
    if (!configuredUri) throw new Error('MONGODB_URI is required to run auth integration tests.');
    const uri = new URL(configuredUri);
    uri.pathname = `/transport_erp_auth_test_${process.pid}`;
    return uri.toString();
})();

async function request(pathname, { method = 'GET', token, body } = {}) {
    const response = await fetch(`${baseUrl}/api/v1${pathname}`, {
        method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    return { response, body: await response.json() };
}

async function uploadRequest(pathname, { token, fields: values, fileName, fileType, fileContent }) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', new Blob([fileContent], { type: fileType }), fileName);
    const response = await fetch(`${baseUrl}/api/v1${pathname}`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: formData
    });
    return { response, body: await response.json() };
}

async function registerCustomer(details) {
    return request('/auth/register', {
        method: 'POST',
        body: {
            ...details,
            email: details.email || `auth-test-${process.pid}-${++registrationNumber}@example.com`
        }
    });
}

before(async () => {
    server = await startServer({ mongoUri: testUri, port: 0 });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }

    try {
        if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    } finally {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    }
});

test('health endpoint reports a connected database', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'connected');
});

test('browser API access is limited to configured origins', async () => {
    const allowed = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'http://localhost:5173' }
    });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');

    const rejected = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'https://untrusted.example' }
    });
    assert.equal(rejected.headers.get('access-control-allow-origin'), null);
});

test('OpenAPI documentation includes customer management and portal routes', async () => {
    const response = await fetch(`${baseUrl}/api/docs.json`);
    const spec = await response.json();
    assert.equal(response.status, 200);
    assert.ok(spec.paths['/api/v1/customers/management']);
    assert.ok(spec.paths['/api/v1/customers/feedback']);
    assert.ok(spec.paths['/api/v1/customers/feedback/options/shipments']);
    assert.ok(spec.paths['/api/v1/customers/feedback/summary']);
    assert.ok(spec.paths['/api/v1/customers/portal/profile']);
    assert.ok(spec.paths['/api/v1/customers/portal/kyc/documents']);
    assert.ok(spec.paths['/api/v1/customers/booking']);
    assert.ok(spec.paths['/api/v1/customers/booking/calendar']);
    assert.ok(spec.paths['/api/v1/customers/booking/{bookingId}/quote']);
    assert.ok(spec.paths['/api/v1/customers/booking/{bookingId}/quote/decision']);
    assert.ok(spec.paths['/api/v1/fleet/vehicles']);
    assert.ok(spec.paths['/api/v1/fleet/vehicles/allocations']);
    assert.ok(spec.paths['/api/v1/fleet/vehicles/utilization']);
    assert.ok(spec.paths['/api/v1/drivers']);
    assert.ok(spec.paths['/api/v1/drivers/licenses']);
    assert.ok(spec.paths['/api/v1/drivers/attendance']);
    assert.ok(spec.paths['/api/v1/drivers/payments']);
    assert.ok(spec.paths['/api/v1/drivers/performance']);
    assert.ok(spec.paths['/api/v1/trips']);
    assert.ok(spec.paths['/api/v1/trips/plans']);
    assert.ok(spec.paths['/api/v1/trips/assignments']);
    assert.ok(spec.paths['/api/v1/trips/active']);
    assert.ok(spec.paths['/api/v1/trips/history']);
    assert.ok(spec.paths['/api/v1/trips/metrics']);
    assert.ok(spec.paths['/api/v1/cargo/shipments']);
    assert.ok(spec.paths['/api/v1/cargo/shipments/{id}/pod']);
    assert.ok(spec.paths['/api/v1/cargo/shipments/{id}/live-location']);
    assert.ok(spec.paths['/api/v1/billing/gst-profile']);
    assert.ok(spec.paths['/api/v1/billing/invoices']);
    assert.ok(spec.paths['/api/v1/billing/invoices/{id}/payments']);
    assert.ok(spec.paths['/api/v1/billing/expenses']);
    assert.ok(spec.paths['/api/v1/billing/expenses/reports/summary']);
    assert.ok(spec.paths['/api/v1/fuel/entries']);
    assert.ok(spec.paths['/api/v1/fuel/reports/summary']);
    assert.ok(spec.paths['/api/v1/maintenance/records']);
    assert.ok(spec.paths['/api/v1/maintenance/reminders']);
    assert.ok(spec.paths['/api/v1/maintenance/vehicles/{id}/documents/{documentType}']);
    assert.ok(spec.paths['/api/v1/routes']);
    assert.ok(spec.paths['/api/v1/routes/suggestions']);
    assert.ok(spec.paths['/api/v1/routes/{id}/archive']);
    assert.ok(spec.paths['/api/v1/gps/active']);
    assert.ok(spec.paths['/api/v1/gps/trips/{tripId}/locations']);
    assert.ok(spec.paths['/api/v1/gps/geofences']);
    assert.ok(spec.paths['/api/v1/gps/alerts']);
    assert.ok(spec.paths['/api/v1/gps/map-config']);
    assert.ok(spec.paths['/api/v1/drivers/performance']);
    assert.ok(spec.paths['/api/v1/billing/reports/summary']);
    assert.ok(spec.paths['/api/v1/maintenance/reports/summary']);
    assert.ok(spec.paths['/api/v1/notifications']);
    assert.ok(spec.paths['/api/v1/notifications/{id}/read']);
    assert.ok(spec.paths['/api/v1/notifications/read-all']);
    assert.equal(spec.paths['/api/v1/auth/otp/request'], undefined);
    assert.ok(spec.paths['/api/v1/drivers/documents/{id}/download']);
});

test('public customer registration uses email and password without SMS OTP', async () => {
    const phone = `7${Date.now().toString().slice(-9)}`;
    const email = `email-login-${process.pid}@example.com`;
    const registration = await request('/auth/register', {
        method: 'POST',
        body: {
            contactPerson: 'Email Test Customer',
            email,
            phone,
            password: 'Customer-Test-Password-123!'
        }
    });
    assert.equal(registration.response.status, 201);
    assert.equal(registration.body.data.role, 'customer');
    assert.equal(registration.body.data.user.loginId, email);
    const customer = await Customer.findOne({ phone });
    assert.equal(customer.email, email);

    await UserAccount.updateOne({ role: 'customer', profileId: customer._id }, { $set: { loginId: phone } });
    const login = await request('/auth/login', {
        method: 'POST',
        body: { loginId: email, password: 'Customer-Test-Password-123!' }
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.data.role, 'customer');

    const removedOtpRoute = await request('/auth/otp/request', { method: 'POST', body: { phone } });
    assert.equal(removedOtpRoute.response.status, 404);

    await UserAccount.deleteOne({ role: 'customer', profileId: customer._id });
    await Customer.deleteOne({ _id: customer._id });
});

test('one login supports admin, manager, driver and customer roles', async () => {
    const adminLogin = await request('/auth/login', {
        method: 'POST',
        body: { loginId: process.env.ADMIN_LOGIN_ID, password: process.env.ADMIN_PASSWORD }
    });

    assert.equal(adminLogin.response.status, 200);
    assert.equal(adminLogin.body.data.role, 'admin');
    adminToken = adminLogin.body.data.accessToken;

    customerPhone = `9${Date.now().toString().slice(-9)}`;
    const customerRegistration = await registerCustomer({
        contactPerson: 'Auth Test Customer',
        phone: customerPhone,
        password: 'Customer-Test-Password-123!'
    });
    assert.equal(customerRegistration.response.status, 201);
    assert.equal(customerRegistration.body.data.role, 'customer');
    customerToken = customerRegistration.body.data.accessToken;

    manager = await Manager.create({
        fullName: 'Auth Test Manager',
        phone: `8${Date.now().toString().slice(-9)}`
    });
    const managerSetup = await request(`/auth/accounts/manager/${manager.id}`, {
        method: 'PUT',
        token: adminToken,
        body: {
            loginId: `auth-test-manager-${process.pid}`,
            password: 'Manager-Test-Password-123!',
            status: 'Active'
        }
    });
    assert.equal(managerSetup.response.status, 200);

    const managerLogin = await request('/auth/login', {
        method: 'POST',
        body: {
            loginId: `auth-test-manager-${process.pid}`,
            password: 'Manager-Test-Password-123!'
        }
    });
    assert.equal(managerLogin.response.status, 200);
    assert.equal(managerLogin.body.data.role, 'manager');
    managerToken = managerLogin.body.data.accessToken;

    driver = await Driver.create({
        driverCode: `AUTH-${process.pid}`,
        personalInfo: { fullName: 'Auth Test Driver' },
        contactInfo: { phone: `7${Date.now().toString().slice(-9)}` },
        employmentDetails: { joiningDate: new Date(), employmentType: 'FullTime' }
    });
    const driverSetup = await request(`/auth/accounts/driver/${driver.id}`, {
        method: 'PUT',
        token: adminToken,
        body: {
            loginId: `auth-test-driver-${process.pid}`,
            password: 'Driver-Test-Password-123!',
            status: 'Active'
        }
    });
    assert.equal(driverSetup.response.status, 200);

    const driverLogin = await request('/auth/login', {
        method: 'POST',
        body: {
            loginId: `auth-test-driver-${process.pid}`,
            password: 'Driver-Test-Password-123!'
        }
    });
    assert.equal(driverLogin.response.status, 200);
    assert.equal(driverLogin.body.data.role, 'driver');
    driverToken = driverLogin.body.data.accessToken;

    for (const [token, role] of [
        [adminToken, 'admin'],
        [managerToken, 'manager'],
        [driverToken, 'driver'],
        [customerToken, 'customer']
    ]) {
        const session = await request('/auth/session', { token });
        assert.equal(session.response.status, 200);
        assert.equal(session.body.data.role, role);
    }
    customerId = (await request('/auth/session', { token: customerToken })).body.data.user.id;
});

test('local MongoDB backup status is admin-only and never enables restore', async () => {
    const adminStatus = await request('/settings/backups/status', { token: adminToken });
    assert.equal(adminStatus.response.status, 200);
    assert.equal(adminStatus.body.data.connected, true);
    assert.equal(adminStatus.body.data.restoreEnabled, false);
    assert.equal(typeof adminStatus.body.data.mongodumpAvailable, 'boolean');

    if (!adminStatus.body.data.mongodumpAvailable) {
        const unavailable = await request('/settings/backups/local', { method: 'POST', token: adminToken });
        assert.equal(unavailable.response.status, 503);
        assert.match(unavailable.body.message, /mongodump/);
    }

    for (const token of [managerToken, driverToken, customerToken]) {
        const denied = await request('/settings/backups/status', { token });
        assert.equal(denied.response.status, 403);
    }

    const docsResponse = await fetch(`${baseUrl}/api/docs.json`);
    const docs = await docsResponse.json();
    assert.equal(docsResponse.status, 200);
    assert.ok(docs.paths['/api/v1/settings/backups/local']);
});

test('booking requests are owned, validated, scheduled and status-audited', async () => {
    const pickup = new Date();
    pickup.setUTCHours(12, 0, 0, 0);
    pickup.setUTCDate(pickup.getUTCDate() + 5);
    const delivery = new Date(pickup);
    delivery.setUTCDate(delivery.getUTCDate() + 2);
    const payload = {
        pickupAddress: {
            contactName: 'Pickup Contact',
            contactPhone: '+919876543210',
            street: '1 Pickup Road',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            landmark: '',
            country: 'India'
        },
        deliveryAddress: {
            contactName: 'Delivery Contact',
            contactPhone: '+919876543211',
            street: '2 Delivery Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            landmark: '',
            country: 'India'
        },
        cargo: {
            goodsType: 'Electronics',
            description: 'Packed electronics',
            packageType: 'carton',
            quantity: 12,
            weightKg: 240,
            volumeCbm: 3.5,
            specialInstructions: 'Keep dry'
        },
        vehicleRequirement: {
            vehicleType: 'Container',
            minCapacityKg: 500,
            specialRequirements: 'Sealed cargo'
        },
        schedule: {
            pickupDate: pickup.toISOString(),
            expectedDeliveryDate: delivery.toISOString()
        }
    };

    const invalidSchedule = await request('/customers/booking/vehicle', {
        method: 'POST',
        token: customerToken,
        body: { ...payload, schedule: { ...payload.schedule, expectedDeliveryDate: new Date(pickup.getTime() - 86400000).toISOString() } }
    });
    assert.equal(invalidSchedule.response.status, 400);

    const bookingResponse = await request('/customers/booking/online', {
        method: 'POST',
        token: customerToken,
        body: payload
    });
    assert.equal(bookingResponse.response.status, 201);
    const booking = bookingResponse.body.data;
    assert.match(booking.bookingNumber, /^BK-\d{4}-\d{6}$/);
    assert.equal(booking.bookingType, 'online');
    assert.equal(booking.bookingStatus, 'pending');
    assert.equal(booking.statusHistory.length, 1);
    assert.equal(booking.statusHistory[0].role, 'customer');

    const otherCustomer = await registerCustomer({
        contactPerson: 'Booking Isolation Customer',
        phone: `6${Date.now().toString().slice(-9)}`,
        password: 'Other-Customer-Password-123!'
    });
    assert.equal(otherCustomer.response.status, 201);
    const otherToken = otherCustomer.body.data.accessToken;
    otherCustomerToken = otherToken;

    const customerList = await request('/customers/booking?page=1&limit=20', { token: customerToken });
    assert.equal(customerList.response.status, 200);
    assert.equal(customerList.body.data.bookings.length, 1);
    assert.equal(customerList.body.data.pagination.total, 1);

    const otherList = await request('/customers/booking?page=1&limit=20', { token: otherToken });
    assert.equal(otherList.body.data.bookings.length, 0);

    const deniedDetails = await request(`/customers/booking/${booking._id}`, { token: otherToken });
    assert.equal(deniedDetails.response.status, 404);
    const deniedCancellation = await request(`/customers/booking/${booking._id}/status`, {
        method: 'PATCH',
        token: otherToken,
        body: { status: 'cancelled' }
    });
    assert.equal(deniedCancellation.response.status, 404);
    const driverBookingList = await request('/customers/booking?page=1&limit=20', { token: driverToken });
    assert.equal(driverBookingList.response.status, 403);
    const deniedCalendar = await request(`/customers/booking/calendar?startDate=${pickup.toISOString().slice(0, 10)}&endDate=${delivery.toISOString().slice(0, 10)}`, { token: customerToken });
    assert.equal(deniedCalendar.response.status, 403);

    const initialHistory = await request(`/customers/booking/${booking._id}/history`, { token: customerToken });
    assert.equal(initialHistory.response.status, 200);
    assert.equal(initialHistory.body.data[0].status, 'pending');

    const staffToPending = await request(`/customers/booking/${booking._id}/status`, {
        method: 'PATCH',
        token: customerToken,
        body: { status: 'under_review' }
    });
    assert.equal(staffToPending.response.status, 403);

    const underReview = await request(`/customers/booking/${booking._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'under_review', remarks: 'Reviewing the shipment request.' }
    });
    assert.equal(underReview.response.status, 200);
    const cannotQuoteWithoutPrice = await request(`/customers/booking/${booking._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'quoted' }
    });
    assert.equal(cannotQuoteWithoutPrice.response.status, 409);

    const validUntil = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const quotePayload = {
        validUntil,
        terms: 'Price valid for the stated cargo and schedule.',
        items: [
            { description: 'Transport charge', quantity: 1, unitPrice: 1000 },
            { description: 'Loading service', quantity: 2.5, unitPrice: 308 }
        ]
    };
    const firstQuote = await request(`/customers/booking/${booking._id}/quote`, {
        method: 'PUT',
        token: managerToken,
        body: quotePayload
    });
    assert.equal(firstQuote.response.status, 200);
    assert.equal(firstQuote.body.data.bookingStatus, 'quoted');
    assert.equal(firstQuote.body.data.quote.version, 1);
    assert.equal(firstQuote.body.data.quote.totalPaise, 177000);

    const revisedQuote = await request(`/customers/booking/${booking._id}/quote`, {
        method: 'PUT',
        token: managerToken,
        body: { ...quotePayload, terms: 'Revised quote; same agreed charges.' }
    });
    assert.equal(revisedQuote.response.status, 200);
    assert.equal(revisedQuote.body.data.quote.version, 2);

    const staleQuoteDecision = await request(`/customers/booking/${booking._id}/quote/decision`, {
        method: 'PATCH',
        token: customerToken,
        body: { decision: 'accept', version: 1 }
    });
    assert.equal(staleQuoteDecision.response.status, 409);
    const otherCustomerQuoteDecision = await request(`/customers/booking/${booking._id}/quote/decision`, {
        method: 'PATCH',
        token: otherToken,
        body: { decision: 'accept', version: 2 }
    });
    assert.equal(otherCustomerQuoteDecision.response.status, 404);
    const managerCannotConfirmQuote = await request(`/customers/booking/${booking._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'confirmed' }
    });
    assert.equal(managerCannotConfirmQuote.response.status, 409);
    const acceptedQuote = await request(`/customers/booking/${booking._id}/quote/decision`, {
        method: 'PATCH',
        token: customerToken,
        body: { decision: 'accept', version: 2 }
    });
    assert.equal(acceptedQuote.response.status, 200);
    assert.equal(acceptedQuote.body.data.bookingStatus, 'confirmed');
    assert.equal(acceptedQuote.body.data.quote.status, 'Accepted');
    assert.equal(acceptedQuote.body.data.statusHistory.at(-1).role, 'customer');
    const declineWithoutReason = await request(`/customers/booking/${booking._id}/quote/decision`, {
        method: 'PATCH',
        token: customerToken,
        body: { decision: 'decline', version: 2 }
    });
    assert.equal(declineWithoutReason.response.status, 400);
    const cannotReviseAcceptedQuote = await request(`/customers/booking/${booking._id}/quote`, {
        method: 'PUT',
        token: managerToken,
        body: quotePayload
    });
    assert.equal(cannotReviseAcceptedQuote.response.status, 409);

    const invalidTransition = await request(`/customers/booking/${booking._id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'pending' }
    });
    assert.equal(invalidTransition.response.status, 409);

    const confirmedCancellation = await request(`/customers/booking/${booking._id}/status`, {
        method: 'PATCH',
        token: customerToken,
        body: { status: 'cancelled' }
    });
    assert.equal(confirmedCancellation.response.status, 409);

    const detail = await request(`/customers/booking/${booking._id}`, { token: customerToken });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.data.bookingStatus, 'confirmed');
    assert.equal(detail.body.data.statusHistory.length, 5);
    confirmedBooking = booking;

    const listAsStaff = await request('/customers/booking?page=1&limit=20', { token: managerToken });
    assert.equal(listAsStaff.response.status, 200);
    assert.equal(listAsStaff.body.data.pagination.total, 1);

    const calendar = await request(`/customers/booking/calendar?startDate=${pickup.toISOString().slice(0, 10)}&endDate=${delivery.toISOString().slice(0, 10)}`, {
        token: adminToken
    });
    assert.equal(calendar.response.status, 200);
    assert.equal(calendar.body.data.length, 1);
    assert.equal(calendar.body.data[0]._id, booking._id);

    const vehicleBooking = await request('/customers/booking/vehicle', {
        method: 'POST',
        token: customerToken,
        body: payload
    });
    assert.equal(vehicleBooking.response.status, 201);
    assert.equal(vehicleBooking.body.data.bookingType, 'vehicle');
    pendingBooking = vehicleBooking.body.data;

    const missingRejectionReason = await request(`/customers/booking/${vehicleBooking.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'rejected' }
    });
    assert.equal(missingRejectionReason.response.status, 400);

    const customerCancellation = await request(`/customers/booking/${vehicleBooking.body.data._id}/status`, {
        method: 'PATCH',
        token: customerToken,
        body: { status: 'cancelled', remarks: 'Plans changed.' }
    });
    assert.equal(customerCancellation.response.status, 200);
    assert.equal(customerCancellation.body.data.bookingStatus, 'cancelled');
    assert.equal(customerCancellation.body.data.statusHistory.at(-1).role, 'customer');

    const declineBookingResponse = await request('/customers/booking/online', {
        method: 'POST',
        token: customerToken,
        body: payload
    });
    assert.equal(declineBookingResponse.response.status, 201);
    const declineBooking = declineBookingResponse.body.data;
    await request(`/customers/booking/${declineBooking._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'under_review' }
    });
    const expiredQuote = await request(`/customers/booking/${declineBooking._id}/quote`, {
        method: 'PUT',
        token: managerToken,
        body: { ...quotePayload, validUntil }
    });
    assert.equal(expiredQuote.response.status, 200);
    await Booking.updateOne(
        { _id: declineBooking._id },
        { $set: { 'quote.validUntil': new Date(Date.now() - 1000) } }
    );
    const cannotAcceptExpiredQuote = await request(`/customers/booking/${declineBooking._id}/quote/decision`, {
        method: 'PATCH',
        token: customerToken,
        body: { decision: 'accept', version: 1 }
    });
    assert.equal(cannotAcceptExpiredQuote.response.status, 409);
    const expiredQuoteStatus = await Booking.findById(declineBooking._id).select('quote.status').lean();
    assert.equal(expiredQuoteStatus.quote.status, 'Expired');
    const replacementQuote = await request(`/customers/booking/${declineBooking._id}/quote`, {
        method: 'PUT',
        token: managerToken,
        body: { ...quotePayload, validUntil }
    });
    assert.equal(replacementQuote.response.status, 200);
    assert.equal(replacementQuote.body.data.quote.version, 2);
    const declinedQuote = await request(`/customers/booking/${declineBooking._id}/quote/decision`, {
        method: 'PATCH',
        token: customerToken,
        body: { decision: 'decline', version: 2, remarks: 'The delivery date no longer works.' }
    });
    assert.equal(declinedQuote.response.status, 200);
    assert.equal(declinedQuote.body.data.bookingStatus, 'rejected');
    assert.equal(declinedQuote.body.data.quote.status, 'Declined');
});

test('fleet vehicle records and confirmed-booking allocations enforce fleet rules', async (t) => {
    const fleetDashboard = await request('/fleet/vehicles/dashboard', { token: managerToken });
    assert.equal(fleetDashboard.response.status, 200);
    assert.equal(typeof fleetDashboard.body.data.summary.total, 'number');
    const invalidUtilizationRange = await request('/fleet/vehicles/utilization?startDate=2099-01-01&endDate=2099-01-31', { token: managerToken });
    assert.equal(invalidUtilizationRange.response.status, 400);
    const reversedUtilizationRange = await request('/fleet/vehicles/utilization?startDate=2026-02-01&endDate=2026-01-01', { token: managerToken });
    assert.equal(reversedUtilizationRange.response.status, 400);
    const customerUtilizationAccess = await request('/fleet/vehicles/utilization?startDate=2020-01-01&endDate=2026-01-01', { token: customerToken });
    assert.equal(customerUtilizationAccess.response.status, 403);

    const vehiclePayload = {
        registrationNumber: `MH12AB${String(process.pid).slice(-4)}`,
        vehicleType: 'Container',
        manufacturer: 'Test Motors',
        model: 'Hauler 500',
        manufacturingYear: 2022,
        capacity: { value: 5, unit: 'Ton' },
        fuelType: 'Diesel',
        ownershipType: 'Owned',
        color: 'White',
        chassisNumber: `CHASSIS-${process.pid}`,
        engineNumber: `ENGINE-${process.pid}`,
        purchaseDate: '2022-05-15T00:00:00.000Z',
        notes: 'Integration test fleet vehicle.',
        documents: {
            insurance: {
                documentNumber: 'POLICY-001',
                fileUrl: 'https://example.test/insurance.pdf',
                issueDate: '2026-01-01T00:00:00.000Z',
                expiryDate: '2027-01-01T00:00:00.000Z'
            }
        }
    };

    const driverDenied = await request('/fleet/vehicles', { token: driverToken });
    assert.equal(driverDenied.response.status, 403);

    const invalidRegistration = await request('/fleet/vehicles', {
        method: 'POST',
        token: adminToken,
        body: { ...vehiclePayload, registrationNumber: '***' }
    });

    await t.test('driver management validates profiles, scopes self-service records, and controls salary workflow', async () => {
        const phone = `8${Date.now().toString().slice(-9)}`;
        const profilePayload = {
            personalInfo: { fullName: 'Driver Management Test', gender: 'Other', dateOfBirth: '' },
            contactInfo: { phone, alternatePhone: '', email: '', address: {} },
            emergencyContact: { name: '', relationship: '', phone: '' },
            employmentDetails: { joiningDate: '2024-01-01', employmentType: 'FullTime', experienceYears: 4 },
            driverStatus: 'Available',
            notes: ''
        };

        const deniedDirectory = await request('/drivers', { token: driverToken });
        assert.equal(deniedDirectory.response.status, 403);

        const created = await request('/drivers', {
            method: 'POST',
            token: managerToken,
            body: profilePayload
        });
        assert.equal(created.response.status, 201);
        const managedDriver = created.body.data;
        assert.match(managedDriver.driverCode, /^DRV-\d{4}-\d{6}$/);

        const duplicatePhone = await request('/drivers', {
            method: 'POST',
            token: adminToken,
            body: profilePayload
        });
        assert.equal(duplicatePhone.response.status, 409);

        const account = await request(`/auth/accounts/driver/${managedDriver._id}`, {
            method: 'PUT',
            token: managerToken,
            body: { loginId: `driver-management-${process.pid}`, password: 'Driver-Management-Password-123!', status: 'Active' }
        });
        assert.equal(account.response.status, 200);
        const login = await request('/auth/login', {
            method: 'POST',
            body: { loginId: `driver-management-${process.pid}`, password: 'Driver-Management-Password-123!' }
        });
        assert.equal(login.response.status, 200);
        const managedDriverToken = login.body.data.accessToken;

        const documentUpload = await uploadRequest('/drivers/documents', {
            token: managerToken,
            fields: { driverId: managedDriver._id, documentType: 'IdentityProof', documentNumber: 'ID-TEST-1' },
            fileName: 'identity.pdf',
            fileType: 'application/pdf',
            fileContent: Buffer.from('%PDF-1.7\nDriver document test')
        });
        assert.equal(documentUpload.response.status, 201);
        assert.equal(documentUpload.body.data.originalName, 'identity.pdf');
        assert.equal(documentUpload.body.data.content, undefined);
        const driverDocumentId = documentUpload.body.data._id;

        const ownDocumentDownload = await fetch(`${baseUrl}/api/v1/drivers/documents/${driverDocumentId}/download`, {
            headers: { Authorization: 'Bearer ' + managedDriverToken }
        });
        assert.equal(ownDocumentDownload.status, 200);
        assert.match(ownDocumentDownload.headers.get('content-type'), /application\/pdf/);
        assert.equal(await ownDocumentDownload.text(), '%PDF-1.7\nDriver document test');

        const otherDriverDownload = await fetch(`${baseUrl}/api/v1/drivers/documents/${driverDocumentId}/download`, {
            headers: { Authorization: 'Bearer ' + driverToken }
        });
        assert.equal(otherDriverDownload.status, 404);

        const invalidDocument = await uploadRequest('/drivers/documents', {
            token: managerToken,
            fields: { driverId: managedDriver._id, documentType: 'IdentityProof' },
            fileName: 'fake.pdf',
            fileType: 'application/pdf',
            fileContent: Buffer.from('not a PDF')
        });
        assert.equal(invalidDocument.response.status, 415);

        const licensePayload = {
            driverId: managedDriver._id,
            licenseNumber: `LIC-${process.pid}`,
            licenseType: 'Transport',
            issueDate: '2024-01-01',
            expiryDate: '2099-12-31',
            status: 'Valid'
        };
        const license = await request('/drivers/licenses', {
            method: 'POST',
            token: managerToken,
            body: licensePayload
        });
        assert.equal(license.response.status, 201);
        assert.equal(license.body.data.status, 'Valid');
        const ownLicenses = await request('/drivers/licenses?page=1&limit=10', { token: managedDriverToken });
        assert.equal(ownLicenses.response.status, 200);
        assert.equal(ownLicenses.body.data.data.length, 1);
        const privateLicenseWrite = await request('/drivers/licenses', {
            method: 'POST',
            token: managedDriverToken,
            body: licensePayload
        });
        assert.equal(privateLicenseWrite.response.status, 403);
        const duplicateLicense = await request('/drivers/licenses', {
            method: 'POST',
            token: managerToken,
            body: licensePayload
        });
        assert.equal(duplicateLicense.response.status, 409);
        const updatedLicense = await request(`/drivers/licenses/${license.body.data._id}`, {
            method: 'PATCH',
            token: managerToken,
            body: {
                driverId: managedDriver._id,
                licenseNumber: `LIC-UPDATED-${process.pid}`,
                licenseType: 'Transport',
                issueDate: '2024-01-01',
                expiryDate: '2099-12-31'
            }
        });
        assert.equal(updatedLicense.response.status, 200);
        assert.equal(updatedLicense.body.data.licenseNumber, `LIC-UPDATED-${process.pid}`);

        const attendancePayload = {
            driverId: managedDriver._id,
            attendanceDate: new Date().toISOString().slice(0, 10),
            status: 'Present',
            checkIn: '09:00',
            checkOut: '18:00',
            remarks: 'Shift completed.'
        };
        const attendance = await request('/drivers/attendance', {
            method: 'POST',
            token: managerToken,
            body: attendancePayload
        });
        assert.equal(attendance.response.status, 201);
        const duplicateAttendance = await request('/drivers/attendance', {
            method: 'POST',
            token: managerToken,
            body: attendancePayload
        });
        assert.equal(duplicateAttendance.response.status, 409);
        const privateAttendance = await request('/drivers/attendance?driverId=000000000000000000000001', { token: managedDriverToken });
        assert.equal(privateAttendance.response.status, 200);
        assert.equal(privateAttendance.body.data.data.length, 1);

        const paymentPayload = {
            driverId: managedDriver._id,
            periodStart: '2025-01-01',
            periodEnd: '2025-01-31',
            baseAmount: 1000,
            allowances: 100,
            deductions: 50,
            status: 'Draft'
        };
        const payment = await request('/drivers/payments', {
            method: 'POST',
            token: managerToken,
            body: paymentPayload
        });
        assert.equal(payment.response.status, 201);
        assert.equal(payment.body.data.netAmount, 1050);
        const overlap = await request('/drivers/payments', {
            method: 'POST',
            token: managerToken,
            body: { ...paymentPayload, periodStart: '2025-01-15', periodEnd: '2025-02-15' }
        });
        assert.equal(overlap.response.status, 409);

        const concurrentPayload = { ...paymentPayload, periodStart: '2026-03-01', periodEnd: '2026-03-31' };
        const concurrentResults = await Promise.all([
            request('/drivers/payments', { method: 'POST', token: managerToken, body: concurrentPayload }),
            request('/drivers/payments', {
                method: 'POST',
                token: managerToken,
                body: { ...concurrentPayload, periodStart: '2026-03-15', periodEnd: '2026-04-15' }
            })
        ]);
        assert.deepEqual(concurrentResults.map((result) => result.response.status).sort(), [201, 409]);

        const approved = await request(`/drivers/payments/${payment.body.data._id}/status`, {
            method: 'PATCH',
            token: managerToken,
            body: { status: 'Approved' }
        });
        assert.equal(approved.response.status, 200);
        const paid = await request(`/drivers/payments/${payment.body.data._id}/status`, {
            method: 'PATCH',
            token: managerToken,
            body: { status: 'Paid' }
        });
        assert.equal(paid.response.status, 200);
        assert.ok(paid.body.data.paidAt);
        const paidEdit = await request(`/drivers/payments/${payment.body.data._id}`, {
            method: 'PATCH',
            token: managerToken,
            body: { baseAmount: 900 }
        });
        assert.equal(paidEdit.response.status, 409);
        const ownPayments = await request('/drivers/payments?page=1&limit=10', { token: managedDriverToken });
        assert.equal(ownPayments.response.status, 200);
        assert.equal(ownPayments.body.data.data.length, 2);

        const performance = await request('/drivers/performance', { token: managerToken });
        assert.equal(performance.response.status, 200);
        assert.ok(performance.body.data.summary.presentDays >= 1);
        assert.ok(performance.body.data.summary.attendanceRate > 0);
    });
    assert.equal(invalidRegistration.response.status, 400);

    const created = await request('/fleet/vehicles', {
        method: 'POST',
        token: adminToken,
        body: vehiclePayload
    });
    assert.equal(created.response.status, 201);
    const vehicle = created.body.data;
    assert.equal(vehicle.vehicleStatus, 'Available');
    assert.equal(vehicle.capacity.unit, 'Ton');

    const duplicate = await request('/fleet/vehicles', {
        method: 'POST',
        token: managerToken,
        body: vehiclePayload
    });
    assert.equal(duplicate.response.status, 409);

    const list = await request('/fleet/vehicles?page=1&limit=10&vehicleStatus=Available', { token: managerToken });
    assert.equal(list.response.status, 200);
    assert.equal(list.body.data.data.length, 1);
    assert.equal(list.body.data.pagination.totalVehicles, 1);

    const dashboard = await request('/fleet/vehicles/dashboard', { token: adminToken });
    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.body.data.summary.total, 1);
    assert.equal(dashboard.body.data.summary.available, 1);
    assert.equal(dashboard.body.data.vehicleTypeBreakdown[0]._id, 'Container');

    const undersized = await request('/fleet/vehicles', {
        method: 'POST',
        token: managerToken,
        body: {
            ...vehiclePayload,
            registrationNumber: `MH12CD${String(process.pid).slice(-4)}`,
            chassisNumber: '',
            engineNumber: '',
            capacity: { value: 100, unit: 'KG' }
        }
    });
    assert.equal(undersized.response.status, 201);
    const undersizedEligibility = await request(`/fleet/vehicles/allocations/options/vehicles?bookingId=${confirmedBooking._id}`, {
        token: managerToken
    });
    assert.equal(undersizedEligibility.body.data.length, 1);
    assert.equal(undersizedEligibility.body.data[0]._id, vehicle._id);

    const availableOptions = await request(`/fleet/vehicles/allocations/options/vehicles?bookingId=${confirmedBooking._id}`, {
        token: managerToken
    });
    assert.equal(availableOptions.response.status, 200);
    assert.equal(availableOptions.body.data.length, 1);
    assert.equal(availableOptions.body.data[0]._id, vehicle._id);
    const pendingOptions = await request(`/fleet/vehicles/allocations/options/vehicles?bookingId=${pendingBooking._id}`, {
        token: managerToken
    });
    assert.equal(pendingOptions.response.status, 409);

    const bookingOptions = await request('/fleet/vehicles/allocations/options/bookings', { token: managerToken });
    assert.ok(bookingOptions.body.data.some((booking) => booking._id === confirmedBooking._id));

    const allocationPayload = {
        bookingId: confirmedBooking._id,
        vehicleId: vehicle._id,
        plannedPickupDate: confirmedBooking.schedule.pickupDate,
        plannedDeliveryDate: confirmedBooking.schedule.expectedDeliveryDate,
        remarks: 'Vehicle assigned for the confirmed booking.'
    };
    const allocation = await request('/fleet/vehicles/allocations', {
        method: 'POST',
        token: managerToken,
        body: allocationPayload
    });
    assert.equal(allocation.response.status, 201);
    assert.match(allocation.body.data.allocationNumber, /^AL-\d{4}-\d{6}$/);
    assert.equal(allocation.body.data.allocationStatus, 'Allocated');
    assert.equal(allocation.body.data.vehicleId.vehicleStatus, 'Allocated');

    const lockedStatus = await request(`/fleet/vehicles/${vehicle._id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { vehicleStatus: 'UnderMaintenance' }
    });
    assert.equal(lockedStatus.response.status, 409);

    const lockedEdit = await request(`/fleet/vehicles/${vehicle._id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { manufacturer: 'Changed Motors' }
    });
    assert.equal(lockedEdit.response.status, 409);

    const duplicateAllocation = await request('/fleet/vehicles/allocations', {
        method: 'POST',
        token: adminToken,
        body: allocationPayload
    });
    assert.equal(duplicateAllocation.response.status, 409);

    const deleteActiveVehicle = await request(`/fleet/vehicles/${vehicle._id}`, {
        method: 'DELETE',
        token: adminToken
    });
    assert.equal(deleteActiveVehicle.response.status, 409);

    const allocations = await request('/fleet/vehicles/allocations?page=1&limit=20', { token: adminToken });
    assert.equal(allocations.response.status, 200);
    assert.equal(allocations.body.data.data.length, 1);
    assert.equal(allocations.body.data.data[0].bookingId.bookingNumber, confirmedBooking.bookingNumber);

    const release = await request(`/fleet/vehicles/allocations/${allocation.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { allocationStatus: 'Released', remarks: 'Vehicle returned to fleet.' }
    });
    assert.equal(release.response.status, 200);
    assert.equal(release.body.data.allocationStatus, 'Released');
    assert.equal(release.body.data.vehicleId.vehicleStatus, 'Available');
    assert.equal(release.body.data.statusHistory.at(-1).role, 'manager');

    const vehicleStatus = await request(`/fleet/vehicles/${vehicle._id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { vehicleStatus: 'UnderMaintenance', remarks: 'Scheduled service.' }
    });
    assert.equal(vehicleStatus.response.status, 200);
    assert.equal(vehicleStatus.body.data.vehicleStatus, 'UnderMaintenance');
    assert.equal(vehicleStatus.body.data.statusHistory.at(-1).remarks, 'Scheduled service.');

    const statusFilter = await request('/fleet/vehicles?vehicleStatus=UnderMaintenance', { token: adminToken });
    assert.equal(statusFilter.body.data.data.length, 1);
    assert.equal(statusFilter.body.data.data[0].vehicleStatus, 'UnderMaintenance');
});

test('trip scheduling, route plans, driver assignment, monitoring, and completion enforce the operational flow', async () => {
    const vehiclePayload = {
        registrationNumber: `TRIP${String(process.pid).slice(-4)}`,
        vehicleType: 'Container',
        manufacturer: 'Trip Test Motors',
        model: 'Route Runner',
        manufacturingYear: 2023,
        capacity: { value: 5, unit: 'Ton' },
        fuelType: 'Diesel',
        ownershipType: 'Owned'
    };
    const vehicle = await request('/fleet/vehicles', {
        method: 'POST',
        token: managerToken,
        body: vehiclePayload
    });
    assert.equal(vehicle.response.status, 201);

    const allocation = await request('/fleet/vehicles/allocations', {
        method: 'POST',
        token: managerToken,
        body: {
            bookingId: confirmedBooking._id,
            vehicleId: vehicle.body.data._id,
            plannedPickupDate: confirmedBooking.schedule.pickupDate,
            plannedDeliveryDate: confirmedBooking.schedule.expectedDeliveryDate,
            remarks: 'Allocation for trip integration test.'
        }
    });
    assert.equal(allocation.response.status, 201);

    const driverPhone = `6${Date.now().toString().slice(-9)}`;
    const driverProfile = await request('/drivers', {
        method: 'POST',
        token: managerToken,
        body: {
            personalInfo: { fullName: 'Trip Test Driver', gender: 'Other' },
            contactInfo: { phone: driverPhone },
            employmentDetails: { joiningDate: '2024-01-01', employmentType: 'FullTime', experienceYears: 5 },
            driverStatus: 'Available'
        }
    });
    assert.equal(driverProfile.response.status, 201);

    const licenceExpiry = new Date(confirmedBooking.schedule.expectedDeliveryDate);
    licenceExpiry.setUTCFullYear(licenceExpiry.getUTCFullYear() + 1);
    const licence = await request('/drivers/licenses', {
        method: 'POST',
        token: managerToken,
        body: {
            driverId: driverProfile.body.data._id,
            licenseNumber: `TRIP-LIC-${process.pid}`,
            licenseType: 'Transport',
            issueDate: '2024-01-01',
            expiryDate: licenceExpiry.toISOString(),
            status: 'Valid'
        }
    });
    assert.equal(licence.response.status, 201);

    const unscheduledAllocations = await request('/trips/options/allocations', { token: managerToken });
    assert.ok(unscheduledAllocations.body.data.some((item) => item._id === allocation.body.data._id));
    const scheduled = await request('/trips', {
        method: 'POST',
        token: managerToken,
        body: { allocationId: allocation.body.data._id, notes: 'Deliver cargo to customer.' }
    });
    assert.equal(scheduled.response.status, 201);
    const trip = scheduled.body.data;
    assert.match(trip.tripNumber, /^TR-\d{4}-\d{6}$/);
    assert.equal(trip.tripStatus, 'Scheduled');
    const tripMetrics = await request('/trips/metrics?startDate=2020-01-01&endDate=2099-12-31', { token: managerToken });
    assert.equal(tripMetrics.response.status, 200);
    assert.equal(tripMetrics.body.data.total >= 1, true);

    const scheduledNotifications = await request('/notifications?category=trip', { token: managerToken });
    assert.equal(scheduledNotifications.response.status, 200);
    const scheduledNotification = scheduledNotifications.body.data.data.find((item) => item.eventType === 'TripScheduled' && item.tripNumber === trip.tripNumber);
    assert.ok(scheduledNotification);
    const customerScheduledNotifications = await request('/notifications?unreadOnly=true', { token: customerToken });
    assert.equal(customerScheduledNotifications.response.status, 200);
    assert.ok(customerScheduledNotifications.body.data.data.some((item) => item.eventType === 'TripScheduled' && item.tripNumber === trip.tripNumber));
    const otherCustomerNotifications = await request('/notifications?unreadOnly=true', { token: otherCustomerToken });
    assert.equal(otherCustomerNotifications.response.status, 200);
    assert.equal(otherCustomerNotifications.body.data.data.length, 0);
    const customerAccount = await UserAccount.findOne({ role: 'customer', profileId: customerId }).lean();
    const customerTripNotification = await Notification.findOne({
        recipientAccountId: customerAccount._id,
        eventType: 'TripScheduled',
        tripNumber: trip.tripNumber
    }).lean();
    assert.ok(customerTripNotification);
    const customerCannotReadStaffAlert = await request(`/notifications/${scheduledNotification._id}/read`, {
        method: 'PATCH',
        token: customerToken
    });
    assert.equal(customerCannotReadStaffAlert.response.status, 404);

    const duplicateTrip = await request('/trips', {
        method: 'POST',
        token: managerToken,
        body: { allocationId: allocation.body.data._id }
    });
    assert.equal(duplicateTrip.response.status, 409);

    const eligibleDrivers = await request(`/trips/options/drivers?tripId=${trip._id}`, { token: managerToken });
    assert.equal(eligibleDrivers.response.status, 200);
    assert.ok(eligibleDrivers.body.data.some((item) => item._id === driverProfile.body.data._id));

    const savedRoute = await request('/routes', {
        method: 'POST',
        token: managerToken,
        body: {
            name: 'Pune to Mumbai test route',
            origin: 'Pune',
            destination: 'Mumbai',
            distanceKm: 148,
            estimatedDurationMinutes: 240,
            waypoints: ['Lonavala'],
            tolls: [{ name: 'Test toll plaza', location: 'Expressway', amount: 75.5, vehicleTypes: ['Container'] }]
        }
    });
    assert.equal(savedRoute.response.status, 201);
    assert.match(savedRoute.body.data.routeNumber, /^RT-\d{4}-\d{6}$/);
    const routeSuggestions = await request('/routes/suggestions?origin=Pune&destination=Mumbai&vehicleType=Container', { token: managerToken });
    assert.equal(routeSuggestions.response.status, 200);
    assert.equal(routeSuggestions.body.data.candidates[0].estimatedTollPaise, 7550);
    const customerRoutes = await request('/routes', { token: customerToken });
    assert.equal(customerRoutes.response.status, 403);
    const driverRoutes = await request('/routes', { token: driverToken });
    assert.equal(driverRoutes.response.status, 200);

    const routePlan = await request('/trips/plans', {
        method: 'POST',
        token: managerToken,
        body: {
            tripId: trip._id,
            routeCatalogId: savedRoute.body.data._id,
            plannedStartDate: confirmedBooking.schedule.pickupDate,
            notes: 'Use the approved highway route.'
        }
    });
    assert.equal(routePlan.response.status, 201);
    assert.equal(routePlan.body.data.routeId, savedRoute.body.data.routeNumber);
    assert.equal(routePlan.body.data.distanceKm, 148);
    assert.equal(routePlan.body.data.estimatedTollPaise, 7550);
    assert.equal(routePlan.body.data.routeSnapshot.origin, 'Pune');
    const savedRouteUpdate = await request(`/routes/${savedRoute.body.data._id}`, {
        method: 'PATCH',
        token: managerToken,
        body: { distanceKm: 190, tolls: [{ name: 'Updated toll', location: 'Expressway', amount: 100, vehicleTypes: ['Container'] }] }
    });
    assert.equal(savedRouteUpdate.response.status, 200);
    const plans = await request('/trips/plans?page=1&limit=10', { token: managerToken });
    assert.equal(plans.response.status, 200);
    assert.equal(plans.body.data.data.length, 1);
    assert.equal(plans.body.data.data[0].distanceKm, 148);
    assert.equal(plans.body.data.data[0].estimatedTollPaise, 7550);
    const routeSummary = await request('/routes/reports/summary', { token: managerToken });
    assert.equal(routeSummary.response.status, 200);
    assert.equal(routeSummary.body.data.linkedTripPlans, 1);
    const archivedRoute = await request(`/routes/${savedRoute.body.data._id}/archive`, {
        method: 'PATCH',
        token: managerToken,
        body: { remarks: 'Route retained for historical snapshots only.' }
    });
    assert.equal(archivedRoute.response.status, 200);
    assert.equal(archivedRoute.body.data.isActive, false);
    const planUpdate = await request(`/trips/plans/${routePlan.body.data._id}`, {
        method: 'PATCH',
        token: managerToken,
        body: {
            routeCatalogId: savedRoute.body.data._id,
            routeId: savedRoute.body.data.routeNumber,
            waypoints: 'Pune → Lonavala → Panvel → Mumbai'
        }
    });
    assert.equal(planUpdate.response.status, 200);
    assert.equal(planUpdate.body.data.distanceKm, 148);
    assert.equal(planUpdate.body.data.estimatedTollPaise, 7550);

    const assigned = await request(`/trips/${trip._id}/assignment`, {
        method: 'PATCH',
        token: managerToken,
        body: { driverId: driverProfile.body.data._id, routeId: savedRoute.body.data.routeNumber }
    });
    assert.equal(assigned.response.status, 200);
    assert.equal(assigned.body.data.tripStatus, 'Assigned');
    assert.equal(assigned.body.data.driverId._id, driverProfile.body.data._id);

    const account = await request(`/auth/accounts/driver/${driverProfile.body.data._id}`, {
        method: 'PUT',
        token: managerToken,
        body: { loginId: `trip-driver-${process.pid}`, password: 'Trip-Driver-Password-123!', status: 'Active' }
    });
    assert.equal(account.response.status, 200);
    const login = await request('/auth/login', {
        method: 'POST',
        body: { loginId: `trip-driver-${process.pid}`, password: 'Trip-Driver-Password-123!' }
    });
    assert.equal(login.response.status, 200);
    const tripDriverToken = login.body.data.accessToken;

    const shipmentCreate = await request('/cargo/shipments', {
        method: 'POST',
        token: managerToken,
        body: { bookingId: confirmedBooking._id }
    });
    assert.equal(shipmentCreate.response.status, 201);
    const shipment = shipmentCreate.body.data;
    assert.match(shipment.consignmentNumber, /^CN-\d{4}-\d{6}$/);
    assert.equal(shipment.shipmentStatus, 'Booked');
    assert.equal(shipment.bookingId.bookingNumber, confirmedBooking.bookingNumber);
    assert.equal(shipment.trip.tripNumber, trip.tripNumber);

    const duplicateShipment = await request('/cargo/shipments', {
        method: 'POST',
        token: managerToken,
        body: { bookingId: confirmedBooking._id }
    });
    assert.equal(duplicateShipment.response.status, 409);

    const unconfirmedShipment = await request('/cargo/shipments', {
        method: 'POST',
        token: managerToken,
        body: { bookingId: pendingBooking._id }
    });
    assert.equal(unconfirmedShipment.response.status, 409);

    const customerShipmentCreate = await request('/cargo/shipments', {
        method: 'POST',
        token: customerToken,
        body: { bookingId: confirmedBooking._id }
    });
    assert.equal(customerShipmentCreate.response.status, 403);

    const customerShipments = await request('/cargo/shipments?page=1&limit=10', { token: customerToken });
    assert.equal(customerShipments.response.status, 200);
    assert.equal(customerShipments.body.data.data.length, 1);
    assert.equal(customerShipments.body.data.data[0]._id, shipment._id);
    const otherCustomerShipments = await request('/cargo/shipments?page=1&limit=10', { token: otherCustomerToken });
    assert.equal(otherCustomerShipments.response.status, 200);
    assert.equal(otherCustomerShipments.body.data.data.length, 0);
    const unrelatedDriverShipments = await request('/cargo/shipments?page=1&limit=10', { token: driverToken });
    assert.equal(unrelatedDriverShipments.response.status, 200);
    assert.equal(unrelatedDriverShipments.body.data.data.length, 0);

    const availableShipmentBookings = await request('/cargo/shipments/options/bookings?page=1&limit=10', { token: managerToken });
    assert.equal(availableShipmentBookings.response.status, 200);
    assert.equal(availableShipmentBookings.body.data.data.some((item) => item._id === confirmedBooking._id), false);

    const readyForPickup = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { shipmentStatus: 'ReadyForPickup', remarks: 'Pickup window confirmed.' }
    });
    assert.equal(readyForPickup.response.status, 200);
    const skippedMilestone = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { shipmentStatus: 'InTransit' }
    });
    assert.equal(skippedMilestone.response.status, 409);

    const exception = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { shipmentStatus: 'Exception', remarks: 'Pickup dock temporarily closed.' }
    });
    assert.equal(exception.response.status, 200);
    assert.equal(exception.body.data.previousStatus, 'ReadyForPickup');
    const driverCannotResolveException = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { shipmentStatus: 'ReadyForPickup' }
    });
    assert.equal(driverCannotResolveException.response.status, 403);
    const resolvedException = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { shipmentStatus: 'ReadyForPickup', remarks: 'Pickup dock reopened.' }
    });
    assert.equal(resolvedException.response.status, 200);

    const releaseBlocked = await request(`/fleet/vehicles/allocations/${allocation.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { allocationStatus: 'Released' }
    });
    assert.equal(releaseBlocked.response.status, 409);
    const assignedDriverStatus = await request(`/drivers/${driverProfile.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { driverStatus: 'OnLeave' }
    });
    assert.equal(assignedDriverStatus.response.status, 409);

    const driverAssignments = await request('/trips/assignments?page=1&limit=20', { token: tripDriverToken });
    assert.equal(driverAssignments.response.status, 200);
    assert.ok(driverAssignments.body.data.data.some((item) => item._id === trip._id));
    const unassignedDriverAttempt = await request(`/trips/${trip._id}/status`, {
        method: 'PATCH',
        token: driverToken,
        body: { tripStatus: 'InProgress' }
    });
    assert.equal(unassignedDriverAttempt.response.status, 404);

    const delayedWithoutReason = await request(`/trips/${trip._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { tripStatus: 'Delayed' }
    });
    assert.equal(delayedWithoutReason.response.status, 400);
    const started = await request(`/trips/${trip._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { tripStatus: 'InProgress' }
    });
    assert.equal(started.response.status, 200);
    assert.equal(started.body.data.tripStatus, 'InProgress');
    assert.equal(started.body.data.vehicleId.vehicleStatus, 'OnTrip');
    assert.equal(started.body.data.driverId.driverStatus, 'OnTrip');
    await new Promise((resolve) => setTimeout(resolve, 500));
    const utilizationDuringTrip = await request(`/fleet/vehicles/utilization?startDate=2020-01-01&endDate=${new Date().toISOString().slice(0, 10)}`, { token: managerToken });
    assert.equal(utilizationDuringTrip.response.status, 200);
    const activeVehicleUsage = utilizationDuringTrip.body.data.vehicles.find((item) => item.vehicleId === vehicle.body.data._id);
    assert.equal(activeVehicleUsage.tripCount, 1);
    assert.equal(activeVehicleUsage.trackedTripHours > 0, true);
    const driverTripNotifications = await request('/notifications?category=trip&unreadOnly=true', { token: tripDriverToken });
    assert.equal(driverTripNotifications.response.status, 200);
    assert.ok(driverTripNotifications.body.data.data.some((item) => item.eventType === 'TripInProgress' && item.tripNumber === trip.tripNumber));

    const gpsConfig = await request('/gps/map-config', { token: managerToken });
    assert.equal(gpsConfig.response.status, 200);
    assert.equal(gpsConfig.body.data.provider, 'Google Maps');
    assert.ok(gpsConfig.body.data.apiKey.length > 20);
    const geofence = await request('/gps/geofences', {
        method: 'POST',
        token: managerToken,
        body: { name: 'Trip test depot', latitude: 18.5204, longitude: 73.8567, radiusMeters: 200 }
    });
    assert.equal(geofence.response.status, 201);
    const unauthorizedLocation = await request(`/gps/trips/${trip._id}/location`, {
        method: 'POST',
        token: driverToken,
        body: {
            latitude: 18.5204,
            longitude: 73.8567,
            accuracyMeters: 10,
            speedMetersPerSecond: 30,
            recordedAt: new Date().toISOString()
        }
    });
    assert.equal(unauthorizedLocation.response.status, 404);
    const firstGpsPoint = await request(`/gps/trips/${trip._id}/location`, {
        method: 'POST',
        token: tripDriverToken,
        body: {
            latitude: 18.5204,
            longitude: 73.8567,
            accuracyMeters: 10,
            speedMetersPerSecond: 30,
            recordedAt: new Date().toISOString()
        }
    });
    assert.equal(firstGpsPoint.response.status, 201);
    assert.equal(firstGpsPoint.body.data.location.speedKmh, 108);
    assert.equal(firstGpsPoint.body.data.alertsCreated, 2);
    const customerLiveLocation = await request(`/cargo/shipments/${shipment._id}/live-location`, { token: customerToken });
    assert.equal(customerLiveLocation.response.status, 200);
    assert.equal(customerLiveLocation.body.data.available, true);
    assert.equal(customerLiveLocation.body.data.location.latitude, 18.5204);
    assert.equal(customerLiveLocation.body.data.vehicle.registrationNumber, vehiclePayload.registrationNumber);
    assert.equal(customerLiveLocation.body.data.trail.length, 1);
    const otherCustomerLiveLocation = await request(`/cargo/shipments/${shipment._id}/live-location`, { token: otherCustomerToken });
    assert.equal(otherCustomerLiveLocation.response.status, 404);
    const customerMapConfig = await request('/gps/map-config', { token: customerToken });
    assert.equal(customerMapConfig.response.status, 200);
    const gpsHistory = await request(`/gps/trips/${trip._id}/locations?page=1&limit=20`, { token: tripDriverToken });
    assert.equal(gpsHistory.response.status, 200);
    assert.equal(gpsHistory.body.data.data.length, 1);
    const activeGps = await request('/gps/active?page=1&limit=20', { token: managerToken });
    assert.equal(activeGps.response.status, 200);
    assert.equal(activeGps.body.data.data.find((item) => item._id === trip._id).lastLocation.latitude, 18.5204);
    const gpsAlerts = await request('/gps/alerts?page=1&limit=20', { token: tripDriverToken });
    assert.equal(gpsAlerts.response.status, 200);
    assert.equal(gpsAlerts.body.data.data.length, 2);
    assert.equal(gpsAlerts.body.data.data.some((item) => item.type === 'SpeedLimitExceeded'), true);
    const gpsNotifications = await request('/notifications?category=gps', { token: managerToken });
    assert.equal(gpsNotifications.response.status, 200);
    assert.ok(gpsNotifications.body.data.data.some((item) => item.tripNumber === trip.tripNumber && item.category === 'gps'));
    const markedRead = await request(`/notifications/${scheduledNotification._id}/read`, {
        method: 'PATCH',
        token: managerToken
    });
    assert.equal(markedRead.response.status, 200);
    assert.ok(markedRead.body.data.readAt);
    const markedAllRead = await request('/notifications/read-all', { method: 'PATCH', token: managerToken });
    assert.equal(markedAllRead.response.status, 200);
    assert.equal(markedAllRead.body.data.updatedCount >= 0, true);
    await new Promise((resolve) => setTimeout(resolve, 5100));
    const secondGpsPoint = await request(`/gps/trips/${trip._id}/location`, {
        method: 'POST',
        token: tripDriverToken,
        body: {
            latitude: 18.5304,
            longitude: 73.8567,
            accuracyMeters: 12,
            speedMetersPerSecond: 0.1,
            recordedAt: new Date().toISOString()
        }
    });
    assert.equal(secondGpsPoint.response.status, 201);
    assert.equal(secondGpsPoint.body.data.alertsCreated, 1);
    const geofenceAlerts = await request('/gps/alerts?page=1&limit=20', { token: managerToken });
    assert.equal(geofenceAlerts.body.data.data.length, 3);
    const driverGeofences = await request('/gps/geofences', { token: tripDriverToken });
    assert.equal(driverGeofences.response.status, 200);
    const archivedGeofence = await request(`/gps/geofences/${geofence.body.data._id}/archive`, { method: 'PATCH', token: managerToken });
    assert.equal(archivedGeofence.response.status, 200);

    const pickedUp = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { shipmentStatus: 'PickedUp', remarks: 'Cargo loaded and sealed.' }
    });
    assert.equal(pickedUp.response.status, 200);
    const inTransit = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { shipmentStatus: 'InTransit', remarks: 'Vehicle departed pickup location.' }
    });
    assert.equal(inTransit.response.status, 200);
    assert.equal(inTransit.body.data.statusHistory.at(-1).role, 'driver');

    const activeTrips = await request('/trips/active?page=1&limit=20', { token: managerToken });
    assert.ok(activeTrips.body.data.data.some((item) => item._id === trip._id));
    const delayed = await request(`/trips/${trip._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { tripStatus: 'Delayed', remarks: 'Heavy traffic near the expressway.' }
    });
    assert.equal(delayed.response.status, 200);
    assert.equal(delayed.body.data.tripStatus, 'Delayed');
    const resumed = await request(`/trips/${trip._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { tripStatus: 'InProgress' }
    });
    assert.equal(resumed.response.status, 200);
    const earlyTripCompletion = await request(`/trips/${trip._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { tripStatus: 'Completed', remarks: 'Attempted before delivery handoff.' }
    });
    assert.equal(earlyTripCompletion.response.status, 409);
    const outForDelivery = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { shipmentStatus: 'OutForDelivery', remarks: 'Arrived at the delivery area.' }
    });
    assert.equal(outForDelivery.response.status, 200);
    const invoiceBeforeDelivery = await request('/billing/invoices', {
        method: 'POST',
        token: managerToken,
        body: {
            shipmentId: shipment._id,
            invoiceDate: new Date().toISOString().slice(0, 10),
            dueDate: new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
            items: [{ description: 'Transport charge', quantity: 1, unitPrice: 1000 }]
        }
    });
    assert.equal(invoiceBeforeDelivery.response.status, 409);

    const invalidPodForm = new FormData();
    invalidPodForm.set('receivedBy', 'Warehouse Receiver');
    invalidPodForm.set('receivedAt', new Date().toISOString());
    invalidPodForm.set('file', new Blob(['not a PDF'], { type: 'application/pdf' }), 'invalid.pdf');
    const invalidPod = await fetch(`${baseUrl}/api/v1/cargo/shipments/${shipment._id}/pod`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tripDriverToken}` },
        body: invalidPodForm
    });
    assert.equal(invalidPod.status, 415);

    const podForm = new FormData();
    podForm.set('receivedBy', 'Warehouse Receiver');
    podForm.set('receivedAt', new Date().toISOString());
    podForm.set('remarks', 'Packages counted and received in good condition.');
    podForm.set('file', new Blob([Buffer.from('%PDF-1.7\nminimal POD test document')], { type: 'application/pdf' }), 'delivery-proof.pdf');
    const podUpload = await fetch(`${baseUrl}/api/v1/cargo/shipments/${shipment._id}/pod`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tripDriverToken}` },
        body: podForm
    });
    assert.equal(podUpload.status, 201);
    const podBody = await podUpload.json();
    assert.equal(podBody.data.pod.receivedBy, 'Warehouse Receiver');
    assert.equal(Object.hasOwn(podBody.data.pod, 'content'), false);

    const duplicatePodForm = new FormData();
    duplicatePodForm.set('receivedBy', 'Warehouse Receiver');
    duplicatePodForm.set('receivedAt', new Date().toISOString());
    duplicatePodForm.set('file', new Blob([Buffer.from('%PDF-1.7\nsecond proof')], { type: 'application/pdf' }), 'second-proof.pdf');
    const duplicatePod = await fetch(`${baseUrl}/api/v1/cargo/shipments/${shipment._id}/pod`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tripDriverToken}` },
        body: duplicatePodForm
    });
    assert.equal(duplicatePod.status, 409);

    const earlyDelivery = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { shipmentStatus: 'Delivered' }
    });
    assert.equal(earlyDelivery.response.status, 409);

    const completed = await request(`/trips/${trip._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { tripStatus: 'Completed', remarks: 'Consignment delivered.' }
    });
    assert.equal(completed.response.status, 200);
    assert.equal(completed.body.data.tripStatus, 'Completed');
    assert.ok(completed.body.data.actualStartedAt);
    assert.ok(completed.body.data.actualCompletedAt);
    assert.equal(completed.body.data.vehicleId.vehicleStatus, 'Available');
    assert.equal(completed.body.data.driverId.driverStatus, 'Available');
    assert.equal(completed.body.data.statusHistory.at(-1).role, 'driver');
    const locationAfterCompletion = await request(`/gps/trips/${trip._id}/location`, {
        method: 'POST',
        token: tripDriverToken,
        body: {
            latitude: 18.54,
            longitude: 73.8567,
            accuracyMeters: 10,
            speedMetersPerSecond: 0,
            recordedAt: new Date().toISOString()
        }
    });
    assert.equal(locationAfterCompletion.response.status, 409);

    const delivered = await request(`/cargo/shipments/${shipment._id}/status`, {
        method: 'PATCH',
        token: tripDriverToken,
        body: { shipmentStatus: 'Delivered', remarks: 'Receiver signed the POD.' }
    });
    assert.equal(delivered.response.status, 200);
    assert.equal(delivered.body.data.shipmentStatus, 'Delivered');
    assert.equal(delivered.body.data.statusHistory.at(-1).role, 'driver');

    const feedbackOptions = await request('/customers/feedback/options/shipments', { token: customerToken });
    assert.equal(feedbackOptions.response.status, 200);
    assert.ok(feedbackOptions.body.data.some((item) => item._id === String(shipment._id)));
    const otherCustomerFeedbackOptions = await request('/customers/feedback/options/shipments', { token: otherCustomerToken });
    assert.equal(otherCustomerFeedbackOptions.response.status, 200);
    assert.equal(otherCustomerFeedbackOptions.body.data.length, 0);
    const staffCannotUseCustomerFeedbackOptions = await request('/customers/feedback/options/shipments', { token: managerToken });
    assert.equal(staffCannotUseCustomerFeedbackOptions.response.status, 403);

    const feedbackPayload = {
        shipmentId: String(shipment._id),
        category: 'Delivery',
        rating: 5,
        subject: 'Professional delivery',
        message: 'The driver delivered the shipment safely and on schedule.'
    };
    const feedback = await request('/customers/feedback', {
        method: 'POST',
        token: customerToken,
        body: feedbackPayload
    });
    assert.equal(feedback.response.status, 201);
    assert.equal(feedback.body.data.status, 'Open');
    assert.equal(feedback.body.data.rating, 5);
    const duplicateFeedback = await request('/customers/feedback', {
        method: 'POST',
        token: customerToken,
        body: feedbackPayload
    });
    assert.equal(duplicateFeedback.response.status, 409);
    const anotherCustomerFeedback = await request('/customers/feedback', {
        method: 'POST',
        token: otherCustomerToken,
        body: feedbackPayload
    });
    assert.equal(anotherCustomerFeedback.response.status, 404);
    const driverFeedback = await request('/customers/feedback', {
        method: 'POST',
        token: tripDriverToken,
        body: feedbackPayload
    });
    assert.equal(driverFeedback.response.status, 403);
    const ownFeedback = await request('/customers/feedback?page=1&limit=10', { token: customerToken });
    assert.equal(ownFeedback.response.status, 200);
    assert.equal(ownFeedback.body.data.data.length, 1);
    const hiddenFeedback = await request('/customers/feedback?page=1&limit=10', { token: otherCustomerToken });
    assert.equal(hiddenFeedback.body.data.data.length, 0);
    const cannotResolveWithoutResponse = await request(`/customers/feedback/${feedback.body.data._id}`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'Resolved' }
    });
    assert.equal(cannotResolveWithoutResponse.response.status, 400);
    const reviewFeedback = await request(`/customers/feedback/${feedback.body.data._id}`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'InReview', staffResponse: 'We are reviewing your comments.' }
    });
    assert.equal(reviewFeedback.response.status, 200);
    const resolveFeedback = await request(`/customers/feedback/${feedback.body.data._id}`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'Resolved', staffResponse: 'Thank you. We shared your feedback with the delivery team.' }
    });
    assert.equal(resolveFeedback.response.status, 200);
    const customerFeedbackAfterResolution = await request('/customers/feedback?page=1&limit=10', { token: customerToken });
    assert.equal(customerFeedbackAfterResolution.body.data.data[0].status, 'Resolved');
    assert.equal(customerFeedbackAfterResolution.body.data.data[0].staffResponse, 'Thank you. We shared your feedback with the delivery team.');
    const feedbackSummary = await request('/customers/feedback/summary', { token: managerToken });
    assert.equal(feedbackSummary.response.status, 200);
    assert.equal(feedbackSummary.body.data.total, 1);
    assert.equal(feedbackSummary.body.data.resolved, 1);

    const invoiceDate = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
    const managerGstProfile = await request('/billing/gst-profile', { token: managerToken });
    assert.equal(managerGstProfile.response.status, 200);
    assert.equal(managerGstProfile.body.data.profileComplete, false);
    const customerGstProfile = await request('/billing/gst-profile', { token: customerToken });
    assert.equal(customerGstProfile.response.status, 403);
    const managerCannotUpdateGstProfile = await request('/billing/gst-profile', {
        method: 'PUT',
        token: managerToken,
        body: {}
    });
    assert.equal(managerCannotUpdateGstProfile.response.status, 403);
    const invalidGstProfile = await request('/billing/gst-profile', {
        method: 'PUT',
        token: adminToken,
        body: { gstin: 'not-a-gstin' }
    });
    assert.equal(invalidGstProfile.response.status, 400);
    const invoiceOptions = await request('/billing/options/shipments?page=1&limit=10', { token: managerToken });
    assert.equal(invoiceOptions.response.status, 200);
    assert.ok(invoiceOptions.body.data.data.some((item) => item._id === shipment._id));

    const invoicePayload = {
        shipmentId: shipment._id,
        invoiceDate,
        dueDate,
        taxRatePercent: 0,
        items: [{ description: 'Client-supplied changed price', quantity: 1, unitPrice: 1 }]
    };
    const taxAddedAfterQuote = await request('/billing/invoices', {
        method: 'POST',
        token: managerToken,
        body: { ...invoicePayload, taxRatePercent: 18 }
    });
    assert.equal(taxAddedAfterQuote.response.status, 409);
    const invoice = await request('/billing/invoices', {
        method: 'POST',
        token: managerToken,
        body: invoicePayload
    });
    assert.equal(invoice.response.status, 201);
    assert.match(invoice.body.data.invoiceNumber, /^INV-\d{4}-\d{6}$/);
    assert.equal(invoice.body.data.invoiceStatus, 'Issued');
    assert.equal(invoice.body.data.subtotalPaise, 177000);
    assert.equal(invoice.body.data.taxPaise, 0);
    assert.equal(invoice.body.data.totalPaise, 177000);
    assert.equal(invoice.body.data.items[0].description, 'Transport charge');
    assert.equal(invoice.body.data.items[0].lineTotalPaise, 100000);
    assert.equal(invoice.body.data.items[1].description, 'Loading service');
    assert.equal(invoice.body.data.items[1].lineTotalPaise, 77000);
    assert.equal(invoice.body.data.taxRateBasisPoints, 0);

    const savedGstProfile = await request('/billing/gst-profile', {
        method: 'PUT',
        token: adminToken,
        body: {
            legalName: 'Test Transport Private Limited',
            gstin: '27AAAAA0000A1Z5',
            registeredState: 'Maharashtra',
            billingAddress: { line1: 'Test Road', city: 'Pune', pincode: '411001', country: 'India' },
            taxCategories: [{ name: 'Transport service', serviceCode: '996511', ratePercent: 18 }],
            taxRatesReviewed: true
        }
    });
    assert.equal(savedGstProfile.response.status, 200);
    assert.equal(savedGstProfile.body.data.profileComplete, true);
    assert.equal(savedGstProfile.body.data.taxCategories[0].ratePercent, 18);

    const duplicateInvoice = await request('/billing/invoices', {
        method: 'POST',
        token: managerToken,
        body: invoicePayload
    });
    assert.equal(duplicateInvoice.response.status, 409);

    const otherCustomerInvoices = await request('/billing/invoices?page=1&limit=10', { token: otherCustomerToken });
    assert.equal(otherCustomerInvoices.response.status, 200);
    assert.equal(otherCustomerInvoices.body.data.data.length, 0);
    const ownInvoices = await request('/billing/invoices?page=1&limit=10', { token: customerToken });
    assert.equal(ownInvoices.response.status, 200);
    assert.equal(ownInvoices.body.data.data.length, 1);
    assert.equal(ownInvoices.body.data.data[0]._id, invoice.body.data._id);

    const customerCannotRecordPayment = await request(`/billing/invoices/${invoice.body.data._id}/payments`, {
        method: 'POST',
        token: customerToken,
        body: {
            idempotencyKey: `customer-payment-${process.pid}-01`,
            amount: 770,
            method: 'Cash',
            paidAt: new Date().toISOString()
        }
    });
    assert.equal(customerCannotRecordPayment.response.status, 403);

    const firstPaymentPayload = {
        idempotencyKey: `billing-payment-${process.pid}-first`,
        amount: 770,
        method: 'Cash',
        paidAt: new Date().toISOString(),
        notes: 'Cash received at the branch.'
    };
    const firstPayment = await request(`/billing/invoices/${invoice.body.data._id}/payments`, {
        method: 'POST',
        token: managerToken,
        body: firstPaymentPayload
    });
    assert.equal(firstPayment.response.status, 201);
    assert.equal(firstPayment.body.data.amountPaidPaise, 77000);
    assert.equal(firstPayment.body.data.invoiceStatus, 'PartiallyPaid');
    assert.match(firstPayment.body.data.payments[0].receiptNumber, /^RC-\d{4}-\d{6}$/);

    const idempotentPaymentRetry = await request(`/billing/invoices/${invoice.body.data._id}/payments`, {
        method: 'POST',
        token: managerToken,
        body: firstPaymentPayload
    });
    assert.equal(idempotentPaymentRetry.response.status, 200);
    assert.equal(idempotentPaymentRetry.body.data.payments.length, 1);

    const mismatchedIdempotencyRetry = await request(`/billing/invoices/${invoice.body.data._id}/payments`, {
        method: 'POST',
        token: managerToken,
        body: { ...firstPaymentPayload, amount: 771 }
    });
    assert.equal(mismatchedIdempotencyRetry.response.status, 409);

    const concurrentPayments = await Promise.all([
        request(`/billing/invoices/${invoice.body.data._id}/payments`, {
            method: 'POST',
            token: managerToken,
            body: {
                idempotencyKey: `billing-payment-${process.pid}-race-a`,
                amount: 600,
                method: 'UPI',
                transactionReference: `UPI-RACE-A-${process.pid}`,
                paidAt: new Date().toISOString()
            }
        }),
        request(`/billing/invoices/${invoice.body.data._id}/payments`, {
            method: 'POST',
            token: managerToken,
            body: {
                idempotencyKey: `billing-payment-${process.pid}-race-b`,
                amount: 600,
                method: 'UPI',
                transactionReference: `UPI-RACE-B-${process.pid}`,
                paidAt: new Date().toISOString()
            }
        })
    ]);
    assert.deepEqual(concurrentPayments.map((result) => result.response.status).sort(), [201, 409]);

    const excessivePayment = await request(`/billing/invoices/${invoice.body.data._id}/payments`, {
        method: 'POST',
        token: managerToken,
        body: {
            idempotencyKey: `billing-payment-${process.pid}-excess`,
            amount: 1000,
            method: 'UPI',
            transactionReference: 'UPI-OVERPAY-REF',
            paidAt: new Date().toISOString()
        }
    });
    assert.equal(excessivePayment.response.status, 409);

    const paymentFilter = await request('/billing/payments?page=1&limit=10', { token: customerToken });
    assert.equal(paymentFilter.response.status, 200);
    assert.equal(paymentFilter.body.data.data.length, 2);
    assert.ok(paymentFilter.body.data.data.every((payment) => payment.invoiceNumber === invoice.body.data.invoiceNumber));
    const otherCustomerPayments = await request('/billing/payments?page=1&limit=10', { token: otherCustomerToken });
    assert.equal(otherCustomerPayments.body.data.data.length, 0);

    const finalPayment = await request(`/billing/invoices/${invoice.body.data._id}/payments`, {
        method: 'POST',
        token: adminToken,
        body: {
            idempotencyKey: `billing-payment-${process.pid}-final`,
            amount: 400,
            method: 'UPI',
            transactionReference: `UPI-REF-${process.pid}`,
            paidAt: new Date().toISOString()
        }
    });
    assert.equal(finalPayment.response.status, 201);
    assert.equal(finalPayment.body.data.amountPaidPaise, 177000);
    assert.equal(finalPayment.body.data.invoiceStatus, 'Paid');

    const overpaidInvoice = await request(`/billing/invoices/${invoice.body.data._id}/payments`, {
        method: 'POST',
        token: managerToken,
        body: {
            idempotencyKey: `billing-payment-${process.pid}-after-paid`,
            amount: 1,
            method: 'Cash',
            paidAt: new Date().toISOString()
        }
    });
    assert.equal(overpaidInvoice.response.status, 409);

    const financialSummary = await request('/billing/reports/summary', { token: managerToken });
    assert.equal(financialSummary.response.status, 200);
    assert.equal(financialSummary.body.data.invoiceCount, 1);
    assert.equal(financialSummary.body.data.billedPaise, 177000);
    assert.equal(financialSummary.body.data.collectedPaise, 177000);
    assert.equal(financialSummary.body.data.outstandingPaise, 0);
    const filteredFinancialSummary = await request(`/billing/reports/summary?startDate=${new Date().toISOString().slice(0, 10)}&endDate=${new Date().toISOString().slice(0, 10)}`, { token: managerToken });
    assert.equal(filteredFinancialSummary.response.status, 200);

    const customerFuelAccess = await request('/fuel/entries?page=1&limit=10', { token: customerToken });
    assert.equal(customerFuelAccess.response.status, 403);
    const fuelVehicles = await request('/fuel/options/vehicles?page=1&limit=100', { token: managerToken });
    assert.equal(fuelVehicles.response.status, 200);
    assert.ok(fuelVehicles.body.data.data.some((item) => item._id === vehicle.body.data._id));
    const fuelTrips = await request(`/fuel/options/trips?vehicleId=${vehicle.body.data._id}`, { token: managerToken });
    assert.equal(fuelTrips.response.status, 200);
    assert.ok(fuelTrips.body.data.some((item) => item._id === trip._id));

    const firstFuelEntryPayload = {
        idempotencyKey: `fuel-entry-${process.pid}-first`,
        vehicleId: vehicle.body.data._id,
        tripId: trip._id,
        filledAt: new Date(Date.now() - 120000).toISOString(),
        quantity: 40,
        unit: 'Litre',
        pricePerUnit: 95.5,
        odometerKm: 10000,
        isFullTank: true,
        vendor: 'Test fuel station',
        receiptNumber: `FUEL-${process.pid}-01`
    };
    const firstFuelEntry = await request('/fuel/entries', {
        method: 'POST',
        token: managerToken,
        body: firstFuelEntryPayload
    });
    assert.equal(firstFuelEntry.response.status, 201);
    assert.equal(firstFuelEntry.body.data.totalCostPaise, 382000);
    const repeatedFuelEntry = await request('/fuel/entries', {
        method: 'POST',
        token: managerToken,
        body: firstFuelEntryPayload
    });
    assert.equal(repeatedFuelEntry.response.status, 200);
    assert.equal(repeatedFuelEntry.body.data._id, firstFuelEntry.body.data._id);
    const conflictingFuelEntryRetry = await request('/fuel/entries', {
        method: 'POST',
        token: managerToken,
        body: { ...firstFuelEntryPayload, quantity: 41 }
    });
    assert.equal(conflictingFuelEntryRetry.response.status, 409);

    const secondFuelEntry = await request('/fuel/entries', {
        method: 'POST',
        token: managerToken,
        body: {
            idempotencyKey: `fuel-entry-${process.pid}-second`,
            vehicleId: vehicle.body.data._id,
            tripId: trip._id,
            filledAt: new Date(Date.now() - 60000).toISOString(),
            quantity: 60,
            unit: 'Litre',
            pricePerUnit: 96.25,
            odometerKm: 10400,
            isFullTank: true,
            vendor: 'Test fuel station',
            receiptNumber: `FUEL-${process.pid}-02`
        }
    });
    assert.equal(secondFuelEntry.response.status, 201);
    assert.equal(secondFuelEntry.body.data.totalCostPaise, 577500);
    assert.equal(secondFuelEntry.body.data.mileageKmPerUnit, 6.667);

    const wrongUnitFuelEntry = await request('/fuel/entries', {
        method: 'POST',
        token: managerToken,
        body: {
            idempotencyKey: `fuel-entry-${process.pid}-wrong-unit`,
            vehicleId: vehicle.body.data._id,
            filledAt: new Date().toISOString(),
            quantity: 10,
            unit: 'Kg',
            pricePerUnit: 100,
            odometerKm: 10500
        }
    });
    assert.equal(wrongUnitFuelEntry.response.status, 400);
    const staleOdometerFuelEntry = await request('/fuel/entries', {
        method: 'POST',
        token: managerToken,
        body: {
            idempotencyKey: `fuel-entry-${process.pid}-stale-odometer`,
            vehicleId: vehicle.body.data._id,
            filledAt: new Date().toISOString(),
            quantity: 10,
            unit: 'Litre',
            pricePerUnit: 100,
            odometerKm: 10399
        }
    });
    assert.equal(staleOdometerFuelEntry.response.status, 409);

    const fuelSummary = await request(`/fuel/reports/summary?vehicleId=${vehicle.body.data._id}`, { token: managerToken });
    assert.equal(fuelSummary.response.status, 200);
    assert.equal(fuelSummary.body.data.entryCount, 2);
    assert.equal(fuelSummary.body.data.totalCostPaise, 959500);
    assert.equal(fuelSummary.body.data.mileage[0].mileageKmPerUnit, 6.667);
    const filteredFuelSummary = await request(`/fuel/reports/summary?vehicleId=${vehicle.body.data._id}&startDate=2020-01-01&endDate=2099-12-31`, { token: managerToken });
    assert.equal(filteredFuelSummary.response.status, 200);
    const fuelEntries = await request(`/fuel/entries?vehicleId=${vehicle.body.data._id}&page=1&limit=10`, { token: adminToken });
    assert.equal(fuelEntries.response.status, 200);
    assert.equal(fuelEntries.body.data.data.length, 2);

    const expensePayload = {
        idempotencyKey: `expense-test-${process.pid}-toll`,
        category: 'Toll',
        description: 'Highway toll for delivery',
        amount: 123.45,
        incurredAt: new Date().toISOString(),
        vehicleId: vehicle.body.data._id,
        tripId: trip._id,
        vendor: 'Expressway plaza',
        reference: `TOLL-${process.pid}`,
        notes: 'Recorded during trip integration test.'
    };
    const recordedExpense = await request('/billing/expenses', {
        method: 'POST',
        token: managerToken,
        body: expensePayload
    });
    assert.equal(recordedExpense.response.status, 201);
    assert.equal(recordedExpense.body.data.amountPaise, 12345);
    assert.equal(recordedExpense.body.data.vehicleId._id, vehicle.body.data._id);
    assert.equal(recordedExpense.body.data.tripId._id, trip._id);
    const duplicateExpense = await request('/billing/expenses', {
        method: 'POST',
        token: managerToken,
        body: expensePayload
    });
    assert.equal(duplicateExpense.response.status, 200);
    assert.equal(duplicateExpense.body.data._id, recordedExpense.body.data._id);
    const conflictingExpenseKey = await request('/billing/expenses', {
        method: 'POST',
        token: managerToken,
        body: { ...expensePayload, amount: 999 }
    });
    assert.equal(conflictingExpenseKey.response.status, 409);
    const expenseList = await request(`/billing/expenses?category=Toll&vehicleId=${vehicle.body.data._id}&page=1&limit=10`, { token: managerToken });
    assert.equal(expenseList.response.status, 200);
    assert.equal(expenseList.body.data.pagination.total, 1);
    const expenseSummary = await request(`/billing/expenses/reports/summary?category=Toll&vehicleId=${vehicle.body.data._id}`, { token: managerToken });
    assert.equal(expenseSummary.response.status, 200);
    assert.equal(expenseSummary.body.data.entryCount, 1);
    assert.equal(expenseSummary.body.data.totalCostPaise, 12345);
    assert.equal(expenseSummary.body.data.byVehicle[0].vehicle, vehicle.body.data.registrationNumber);
    const customerExpenseAccess = await request('/billing/expenses/reports/summary', { token: customerToken });
    assert.equal(customerExpenseAccess.response.status, 403);
    const mismatchedTripVehicleExpense = await request('/billing/expenses', {
        method: 'POST',
        token: managerToken,
        body: {
            ...expensePayload,
            idempotencyKey: `expense-test-${process.pid}-mismatch`,
            vehicleId: '000000000000000000000000'
        }
    });
    assert.equal(mismatchedTripVehicleExpense.response.status, 400);

    const maintenanceDriverDenied = await request('/maintenance/records?page=1&limit=10', { token: driverToken });
    assert.equal(maintenanceDriverDenied.response.status, 403);
    const maintenanceOptions = await request('/maintenance/options/vehicles?page=1&limit=100', { token: managerToken });
    assert.equal(maintenanceOptions.response.status, 200);
    assert.ok(maintenanceOptions.body.data.data.some((item) => item._id === vehicle.body.data._id));

    const maintenanceDueAt = new Date(Date.now() + 10 * 86400000).toISOString();
    const serviceRecord = await request('/maintenance/records', {
        method: 'POST',
        token: managerToken,
        body: {
            vehicleId: vehicle.body.data._id,
            recordType: 'Service',
            title: 'Periodic vehicle service',
            description: 'Oil, brakes and safety inspection.',
            scheduledAt: maintenanceDueAt,
            dueOdometerKm: 10450,
            vendor: 'Test workshop',
            estimatedCost: 750
        }
    });
    assert.equal(serviceRecord.response.status, 201);
    assert.match(serviceRecord.body.data.recordNumber, /^MNT-\d{4}-\d{6}$/);
    const missingMaintenanceCancelReason = await request(`/maintenance/records/${serviceRecord.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'Cancelled' }
    });
    assert.equal(missingMaintenanceCancelReason.response.status, 400);

    const serviceStarted = await request(`/maintenance/records/${serviceRecord.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { status: 'InProgress', remarks: 'Vehicle received at workshop.' }
    });
    assert.equal(serviceStarted.response.status, 200);
    assert.equal(serviceStarted.body.data.status, 'InProgress');
    assert.equal(serviceStarted.body.data.vehicleId.vehicleStatus, 'UnderMaintenance');
    const manualMaintenanceRelease = await request(`/fleet/vehicles/${vehicle.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { vehicleStatus: 'Available', remarks: 'Attempt to release before work completion.' }
    });
    assert.equal(manualMaintenanceRelease.response.status, 409);
    const maintenanceVehicleStatus = await request(`/fleet/vehicles?search=${vehiclePayload.registrationNumber}&page=1&limit=10`, { token: managerToken });
    assert.equal(maintenanceVehicleStatus.body.data.data[0].vehicleStatus, 'UnderMaintenance');
    const allocationDuringMaintenance = await request('/fleet/vehicles/allocations', {
        method: 'POST',
        token: managerToken,
        body: {
            bookingId: confirmedBooking._id,
            vehicleId: vehicle.body.data._id,
            plannedPickupDate: confirmedBooking.schedule.pickupDate,
            plannedDeliveryDate: confirmedBooking.schedule.expectedDeliveryDate
        }
    });
    assert.equal(allocationDuringMaintenance.response.status, 409);

    const serviceCompleted = await request(`/maintenance/records/${serviceRecord.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: {
            status: 'Completed',
            completionOdometerKm: 10399,
            actualCost: 700
        }
    });
    assert.equal(serviceCompleted.response.status, 400);
    const completedServiceRecord = await request(`/maintenance/records/${serviceRecord.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: {
            status: 'Completed',
            actualCost: 700,
            completionOdometerKm: 10450,
            completionRemarks: 'Service and safety check completed.'
        }
    });
    assert.equal(completedServiceRecord.response.status, 200);
    assert.equal(completedServiceRecord.body.data.status, 'Completed');
    assert.equal(completedServiceRecord.body.data.actualCostPaise, 70000);
    assert.equal(completedServiceRecord.body.data.vehicleId.vehicleStatus, 'Available');

    const repairRecord = await request('/maintenance/records', {
        method: 'POST',
        token: managerToken,
        body: {
            vehicleId: vehicle.body.data._id,
            recordType: 'Repair',
            title: 'Replace damaged tail lamp',
            scheduledAt: new Date(Date.now() + 15 * 86400000).toISOString(),
            estimatedCost: 350
        }
    });
    assert.equal(repairRecord.response.status, 201);
    const odometerDueRecord = await request('/maintenance/records', {
        method: 'POST',
        token: managerToken,
        body: {
            vehicleId: vehicle.body.data._id,
            recordType: 'Service',
            title: 'Odometer-based inspection',
            scheduledAt: new Date(Date.now() + 60 * 86400000).toISOString(),
            dueOdometerKm: 10300
        }
    });
    assert.equal(odometerDueRecord.response.status, 201);
    const insuranceExpiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const insuranceUpdate = await request(`/maintenance/vehicles/${vehicle.body.data._id}/documents/insurance`, {
        method: 'PATCH',
        token: managerToken,
        body: {
            documentNumber: `POLICY-${process.pid}`,
            fileUrl: 'https://example.test/policy.pdf',
            issueDate: new Date().toISOString().slice(0, 10),
            expiryDate: insuranceExpiry
        }
    });
    assert.equal(insuranceUpdate.response.status, 200);
    assert.equal(insuranceUpdate.body.data.documents.insurance.documentNumber, `POLICY-${process.pid}`);
    const vehicleAfterDocumentUpdate = await request(`/fleet/vehicles?search=${vehiclePayload.registrationNumber}&page=1&limit=10`, { token: managerToken });
    assert.equal(vehicleAfterDocumentUpdate.body.data.data[0].documentHistory.at(-1).documentType, 'insurance');
    const invalidFitnessDates = await request(`/maintenance/vehicles/${vehicle.body.data._id}/documents/fitnessCertificate`, {
        method: 'PATCH',
        token: managerToken,
        body: { issueDate: '2027-01-01', expiryDate: '2026-01-01' }
    });
    assert.equal(invalidFitnessDates.response.status, 400);

    const maintenanceReminders = await request('/maintenance/reminders?days=30&page=1&limit=100', { token: managerToken });
    assert.equal(maintenanceReminders.response.status, 200);
    assert.ok(maintenanceReminders.body.data.data.some((item) => item.type === 'DocumentExpiry' && item.title === 'Insurance'));
    assert.ok(maintenanceReminders.body.data.data.some((item) => item.type === 'Maintenance' && item.recordId === repairRecord.body.data._id));
    assert.ok(maintenanceReminders.body.data.data.some((item) => item.type === 'Maintenance' && item.recordId === odometerDueRecord.body.data._id && item.status === 'Overdue'));
    const maintenanceHistory = await request(`/maintenance/records?vehicleId=${vehicle.body.data._id}&page=1&limit=10`, { token: adminToken });
    assert.equal(maintenanceHistory.response.status, 200);
    assert.equal(maintenanceHistory.body.data.data.length, 3);
    const maintenanceSummary = await request('/maintenance/reports/summary', { token: managerToken });
    assert.equal(maintenanceSummary.response.status, 200);
    assert.ok(maintenanceSummary.body.data.completed.some((item) => item.recordType === 'Service' && item.actualCostPaise === 70000));
    const driverPerformanceReport = await request('/drivers/performance?page=1&limit=20&startDate=2020-01-01&endDate=2099-12-31', { token: managerToken });
    assert.equal(driverPerformanceReport.response.status, 200);
    assert.equal(typeof driverPerformanceReport.body.data.summary.attendanceRate, 'number');

    const podDownload = await fetch(`${baseUrl}/api/v1/cargo/shipments/${shipment._id}/pod/download`, {
        headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(podDownload.status, 200);
    assert.equal(podDownload.headers.get('cache-control'), 'private, no-store');
    assert.equal((await podDownload.arrayBuffer()).byteLength, Buffer.byteLength('%PDF-1.7\nminimal POD test document'));

    const otherCustomerPod = await fetch(`${baseUrl}/api/v1/cargo/shipments/${shipment._id}/pod/download`, {
        headers: { Authorization: `Bearer ${otherCustomerToken}` }
    });
    assert.equal(otherCustomerPod.status, 404);

    const closedAllocation = await request(`/fleet/vehicles/allocations/${allocation.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { allocationStatus: 'Released' }
    });
    assert.equal(closedAllocation.response.status, 404);
    const history = await request('/trips/history?page=1&limit=20', { token: managerToken });
    assert.ok(history.body.data.data.some((item) => item._id === trip._id));
    const driverHistory = await request('/trips/history?page=1&limit=20', { token: tripDriverToken });
    assert.ok(driverHistory.body.data.data.some((item) => item._id === trip._id));
    const metrics = await request('/trips/metrics', { token: managerToken });
    assert.equal(metrics.response.status, 200);
    assert.ok(metrics.body.data.completed >= 1);
    const emptyPeriodMetrics = await request('/trips/metrics?startDate=1900-01-01&endDate=1900-12-31', { token: managerToken });
    assert.equal(emptyPeriodMetrics.response.status, 200);
    assert.equal(emptyPeriodMetrics.body.data.total, 0);

    const cancellationAllocation = await request('/fleet/vehicles/allocations', {
        method: 'POST',
        token: managerToken,
        body: {
            bookingId: confirmedBooking._id,
            vehicleId: vehicle.body.data._id,
            plannedPickupDate: confirmedBooking.schedule.pickupDate,
            plannedDeliveryDate: confirmedBooking.schedule.expectedDeliveryDate
        }
    });
    assert.equal(cancellationAllocation.response.status, 201);
    const cancellationTrip = await request('/trips', {
        method: 'POST',
        token: managerToken,
        body: { allocationId: cancellationAllocation.body.data._id }
    });
    assert.equal(cancellationTrip.response.status, 201);
    const missingCancelReason = await request(`/trips/${cancellationTrip.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { tripStatus: 'Cancelled' }
    });
    assert.equal(missingCancelReason.response.status, 400);
    const cancelled = await request(`/trips/${cancellationTrip.body.data._id}/status`, {
        method: 'PATCH',
        token: managerToken,
        body: { tripStatus: 'Cancelled', remarks: 'Booking rescheduled by the customer.' }
    });
    assert.equal(cancelled.response.status, 200);
    assert.equal(cancelled.body.data.tripStatus, 'Cancelled');
    assert.equal(cancelled.body.data.vehicleId.vehicleStatus, 'Available');
    const cancelledHistory = await request('/trips/history?page=1&limit=20', { token: managerToken });
    assert.ok(cancelledHistory.body.data.data.some((item) => item._id === cancellationTrip.body.data._id));
});

test('validation rejects unknown fields and staff role escalation', async () => {
    const invalidLogin = await request('/auth/login', {
        method: 'POST',
        body: { loginId: 'nobody', password: 'wrong', role: 'admin' }
    });
    assert.equal(invalidLogin.response.status, 400);
    assert.equal(invalidLogin.body.message, 'Validation failed');

    const denied = await request(`/auth/accounts/manager/${manager.id}`, {
        method: 'PUT',
        token: managerToken,
        body: { loginId: `other-manager-${process.pid}`, password: 'Other-Password-123!' }
    });
    assert.equal(denied.response.status, 403);
});

test('customer portal profile, preferences and saved-address workflows persist safely', async () => {
    const emptyProfile = await request('/customers/portal/profile', { token: customerToken });
    assert.equal(emptyProfile.response.status, 200);
    assert.equal(emptyProfile.body.data.isProfileComplete, false);

    const incompleteSubmission = await request('/customers/portal/kyc/submit', {
        method: 'POST',
        token: customerToken,
        body: {}
    });
    assert.equal(incompleteSubmission.response.status, 409);

    const profileUpdate = await request('/customers/portal/profile', {
        method: 'PUT',
        token: customerToken,
        body: {
            companyName: 'Test Logistics',
            contactPerson: 'Test Customer',
            email: 'customer@example.com',
            pan: 'ABCDE1234F',
            address: { street: '1 Test Road', city: 'Pune', state: 'Maharashtra', pincode: '411001' }
        }
    });
    assert.equal(profileUpdate.response.status, 200);
    assert.equal(profileUpdate.body.data.isProfileComplete, true);

    const partialAddressUpdate = await request('/customers/portal/profile', {
        method: 'PUT',
        token: customerToken,
        body: { address: { city: 'Mumbai' } }
    });
    assert.equal(partialAddressUpdate.response.status, 200);
    assert.equal(partialAddressUpdate.body.data.address.street, '1 Test Road');
    assert.equal(partialAddressUpdate.body.data.address.city, 'Mumbai');

    const preferences = await request('/customers/portal/preferences', {
        method: 'PUT',
        token: customerToken,
        body: { language: 'hi', notifyBySms: false }
    });
    assert.equal(preferences.response.status, 200);
    assert.equal(preferences.body.data.language, 'hi');
    assert.equal(preferences.body.data.notifyBySms, false);

    const address = await request('/customers/portal/addresses', {
        method: 'POST',
        token: customerToken,
        body: {
            label: 'Warehouse',
            address: '22 Goods Road',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411002',
            isDefault: true
        }
    });
    assert.equal(address.response.status, 201);
    assert.ok(address.body.data._id);

    const addresses = await request('/customers/portal/addresses', { token: customerToken });
    assert.equal(addresses.response.status, 200);
    assert.equal(addresses.body.data.length, 1);
    assert.equal(addresses.body.data[0].isDefault, true);

    const dashboard = await request('/customers/portal/dashboard', { token: customerToken });
    assert.equal(dashboard.body.data.profile.completionPercent, 100);
    assert.equal(dashboard.body.data.savedAddresses, 1);
});

test('staff customer directory, KYC reviews, private documents and follow-ups are role-scoped', async () => {
    const customerList = await request('/customers/management?page=1&limit=10&search=Test%20Customer', { token: adminToken });
    assert.equal(customerList.response.status, 200);
    assert.equal(customerList.body.data.customers.length, 1);
    assert.equal(customerList.body.data.pagination.total, 1);

    const managerDenied = await request('/customers/management/summary', { token: driverToken });
    assert.equal(managerDenied.response.status, 403);

    const summary = await request('/customers/management/summary', { token: adminToken });
    assert.equal(summary.response.status, 200);
    assert.equal(summary.body.data.total, 2);
    const managerSummary = await request('/customers/management/summary', { token: managerToken });
    assert.equal(managerSummary.response.status, 200);

    const submit = await request('/customers/portal/kyc/submit', {
        method: 'POST',
        token: customerToken,
        body: {}
    });
    assert.equal(submit.response.status, 200);

    const approvalWithoutDocuments = await request(`/customers/management/${customerId}/kyc`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'Verified', remarks: 'Verified without optional uploads.' }
    });
    assert.equal(approvalWithoutDocuments.response.status, 200);

    const identityUpdate = await request('/customers/portal/profile', {
        method: 'PUT',
        token: customerToken,
        body: { pan: 'ABCDE1234G' }
    });
    assert.equal(identityUpdate.response.status, 200);
    assert.equal(identityUpdate.body.data.kycStatus, 'NotSubmitted');

    const resubmission = await request('/customers/portal/kyc/submit', {
        method: 'POST',
        token: customerToken,
        body: {}
    });
    assert.equal(resubmission.response.status, 200);

    const activityDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const activity = await request(`/customers/management/${customerId}/activities`, {
        method: 'POST',
        token: adminToken,
        body: {
            type: 'follow_up',
            subject: 'Confirm pickup details',
            description: 'Call customer before the pickup window.',
            followUpAt: activityDate
        }
    });
    assert.equal(activity.response.status, 201);

    const activities = await request(`/customers/management/${customerId}/activities?limit=50`, { token: adminToken });
    assert.equal(activities.response.status, 200);
    assert.equal(activities.body.data.activities.length, 1);

    const complete = await request(`/customers/management/${customerId}/activities/${activity.body.data._id}/complete`, {
        method: 'PATCH',
        token: adminToken,
        body: {}
    });
    assert.equal(complete.response.status, 200);
    assert.ok(complete.body.data.followUpCompletedAt);

    const invalidForm = new FormData();
    invalidForm.set('documentType', 'pan');
    invalidForm.set('file', new Blob(['not a PDF'], { type: 'application/pdf' }), 'invalid.pdf');
    const invalidUpload = await fetch(`${baseUrl}/api/v1/customers/portal/kyc/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: invalidForm
    });
    assert.equal(invalidUpload.status, 415);

    const form = new FormData();
    form.set('documentType', 'pan');
    form.set('file', new Blob([Buffer.from('%PDF-1.7\\nminimal test document')], { type: 'application/pdf' }), 'pan-card.pdf');
    const upload = await fetch(`${baseUrl}/api/v1/customers/portal/kyc/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: form
    });
    const uploaded = await upload.json();
    assert.equal(upload.status, 201);
    assert.equal(uploaded.data.status, 'Pending');
    assert.equal(Object.hasOwn(uploaded.data, 'content'), false);

    const documentList = await request(`/customers/management/${customerId}/kyc/documents`, { token: adminToken });
    assert.equal(documentList.response.status, 200);
    assert.equal(documentList.body.data.length, 1);
    assert.equal(Object.hasOwn(documentList.body.data[0], 'content'), false);

    const blockedApproval = await request(`/customers/management/${customerId}/kyc`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'Verified', remarks: '' }
    });
    assert.equal(blockedApproval.response.status, 409);

    const documentReview = await request(`/customers/management/${customerId}/kyc/documents/${uploaded.data._id}/review`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'Verified', remarks: '' }
    });
    assert.equal(documentReview.response.status, 200);

    const approval = await request(`/customers/management/${customerId}/kyc`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'Verified', remarks: 'Profile verified.' }
    });
    assert.equal(approval.response.status, 200);
    assert.equal(approval.body.data.kycStatus, 'Verified');

    const privateDownload = await fetch(`${baseUrl}/api/v1/customers/management/${customerId}/kyc/documents/${uploaded.data._id}/download`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(privateDownload.status, 200);
    assert.equal(privateDownload.headers.get('cache-control'), 'private, no-store');
    assert.match(await privateDownload.text(), /^%PDF-1\.7/);

    const changedIdentity = await request('/customers/portal/profile', {
        method: 'PUT',
        token: customerToken,
        body: { pan: 'ABCDE1234H' }
    });
    assert.equal(changedIdentity.response.status, 200);
    assert.equal(changedIdentity.body.data.kycStatus, 'NotSubmitted');

    const resubmitAfterChange = await request('/customers/portal/kyc/submit', {
        method: 'POST',
        token: customerToken,
        body: {}
    });
    assert.equal(resubmitAfterChange.response.status, 200);

    const staleDocumentApproval = await request(`/customers/management/${customerId}/kyc`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'Verified', remarks: 'Old document should not remain verified.' }
    });
    assert.equal(staleDocumentApproval.response.status, 409);

    const refreshedDocuments = await request(`/customers/management/${customerId}/kyc/documents`, { token: adminToken });
    assert.equal(refreshedDocuments.body.data[0].status, 'Pending');

    const reverifiedDocument = await request(`/customers/management/${customerId}/kyc/documents/${uploaded.data._id}/review`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'Verified', remarks: '' }
    });
    assert.equal(reverifiedDocument.response.status, 200);

    const otherCustomer = await registerCustomer({
        contactPerson: 'Other Test Customer',
        phone: `6${Date.now().toString().slice(-9)}`,
        password: 'Other-Customer-Password-123!'
    });
    assert.equal(otherCustomer.response.status, 201);
    const otherCustomerDownload = await fetch(`${baseUrl}/api/v1/customers/portal/kyc/documents/${uploaded.data._id}/download`, {
        headers: { Authorization: `Bearer ${otherCustomer.body.data.accessToken}` }
    });
    assert.equal(otherCustomerDownload.status, 404);
});

test('password changes rotate tokens and disabling a login revokes its sessions', async () => {
    const passwordChange = await request('/auth/change-password', {
        method: 'POST',
        token: customerToken,
        body: {
            currentPassword: 'Customer-Test-Password-123!',
            newPassword: 'Customer-Test-Password-456!'
        }
    });
    assert.equal(passwordChange.response.status, 200);

    const oldCustomerSession = await request('/auth/session', { token: customerToken });
    assert.equal(oldCustomerSession.response.status, 401);
    customerToken = passwordChange.body.data.accessToken;
    const newCustomerSession = await request('/auth/session', { token: customerToken });
    assert.equal(newCustomerSession.response.status, 200);

    const adminLogin = await request('/auth/login', {
        method: 'POST',
        body: { loginId: process.env.ADMIN_LOGIN_ID, password: process.env.ADMIN_PASSWORD }
    });
    const disabled = await request(`/auth/accounts/manager/${manager.id}`, {
        method: 'PUT',
        token: adminLogin.body.data.accessToken,
        body: { loginId: `auth-test-manager-${process.pid}`, status: 'Disabled' }
    });
    assert.equal(disabled.response.status, 200);

    const revokedManagerSession = await request('/auth/session', { token: managerToken });
    assert.equal(revokedManagerSession.response.status, 401);
});

test('repeated bad passwords temporarily lock the account', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await request('/auth/login', {
            method: 'POST',
            body: {
                loginId: `auth-test-driver-${process.pid}`,
                password: 'Not-The-Driver-Password'
            }
        });
        assert.equal(result.response.status, 401);
    }

    const locked = await request('/auth/login', {
        method: 'POST',
        body: {
            loginId: `auth-test-driver-${process.pid}`,
            password: 'Driver-Test-Password-123!'
        }
    });
    assert.equal(locked.response.status, 429);
});

test('suspending a customer revokes the customer session', async () => {
    const suspension = await request(`/customers/management/${customerId}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'Suspended', remarks: 'Test suspension.' }
    });
    assert.equal(suspension.response.status, 200);

    const revokedSession = await request('/auth/session', { token: customerToken });
    assert.equal(revokedSession.response.status, 401);
});
