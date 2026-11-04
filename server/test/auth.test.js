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

const { Manager } = require('../src/models/auth/manager.model');
const Driver = require('../src/models/driver/driver.model');
const { startServer } = require('../src');

let server;
let baseUrl;
let customerPhone;
let customerToken;
let customerId;
let adminToken;
let confirmedBooking;
let pendingBooking;
let manager;
let managerToken;
let driver;
let driverToken;

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
    assert.ok(spec.paths['/api/v1/customers/portal/profile']);
    assert.ok(spec.paths['/api/v1/customers/portal/kyc/documents']);
    assert.ok(spec.paths['/api/v1/customers/booking']);
    assert.ok(spec.paths['/api/v1/customers/booking/calendar']);
    assert.ok(spec.paths['/api/v1/fleet/vehicles']);
    assert.ok(spec.paths['/api/v1/fleet/vehicles/allocations']);
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
    const customerRegistration = await request('/auth/register', {
        method: 'POST',
        body: {
            contactPerson: 'Auth Test Customer',
            phone: customerPhone,
            password: 'Customer-Test-Password-123!'
        }
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

    const otherCustomer = await request('/auth/register', {
        method: 'POST',
        body: {
            contactPerson: 'Booking Isolation Customer',
            phone: `6${Date.now().toString().slice(-9)}`,
            password: 'Other-Customer-Password-123!'
        }
    });
    assert.equal(otherCustomer.response.status, 201);
    const otherToken = otherCustomer.body.data.accessToken;

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

    for (const status of ['under_review', 'quoted', 'confirmed']) {
        const updated = await request(`/customers/booking/${booking._id}/status`, {
            method: 'PATCH',
            token: managerToken,
            body: { status, remarks: `Moved to ${status}.` }
        });
        assert.equal(updated.response.status, 200);
        assert.equal(updated.body.data.bookingStatus, status);
    }

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
    assert.equal(detail.body.data.statusHistory.length, 4);
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
});

test('fleet vehicle records and confirmed-booking allocations enforce fleet rules', async (t) => {
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

    const duplicateTrip = await request('/trips', {
        method: 'POST',
        token: managerToken,
        body: { allocationId: allocation.body.data._id }
    });
    assert.equal(duplicateTrip.response.status, 409);

    const eligibleDrivers = await request(`/trips/options/drivers?tripId=${trip._id}`, { token: managerToken });
    assert.equal(eligibleDrivers.response.status, 200);
    assert.ok(eligibleDrivers.body.data.some((item) => item._id === driverProfile.body.data._id));

    const routePlan = await request('/trips/plans', {
        method: 'POST',
        token: managerToken,
        body: {
            tripId: trip._id,
            routeId: 'PUNE-MUMBAI-TEST',
            waypoints: 'Pune → Lonavala → Mumbai',
            plannedStartDate: confirmedBooking.schedule.pickupDate,
            notes: 'Use the approved highway route.'
        }
    });
    assert.equal(routePlan.response.status, 201);
    const plans = await request('/trips/plans?page=1&limit=10', { token: managerToken });
    assert.equal(plans.response.status, 200);
    assert.equal(plans.body.data.data.length, 1);
    const planUpdate = await request(`/trips/plans/${routePlan.body.data._id}`, {
        method: 'PATCH',
        token: managerToken,
        body: { waypoints: 'Pune → Lonavala → Panvel → Mumbai' }
    });
    assert.equal(planUpdate.response.status, 200);

    const assigned = await request(`/trips/${trip._id}/assignment`, {
        method: 'PATCH',
        token: managerToken,
        body: { driverId: driverProfile.body.data._id, routeId: 'PUNE-MUMBAI-TEST' }
    });
    assert.equal(assigned.response.status, 200);
    assert.equal(assigned.body.data.tripStatus, 'Assigned');
    assert.equal(assigned.body.data.driverId._id, driverProfile.body.data._id);

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

    const otherCustomer = await request('/auth/register', {
        method: 'POST',
        body: {
            contactPerson: 'Other Test Customer',
            phone: `6${Date.now().toString().slice(-9)}`,
            password: 'Other-Customer-Password-123!'
        }
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
