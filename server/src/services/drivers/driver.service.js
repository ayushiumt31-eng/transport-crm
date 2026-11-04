const mongoose = require('mongoose');
const Driver = require('../../models/driver/driver.model');
const DriverLicense = require('../../models/driver/driver-license.model');
const DriverDocument = require('../../models/driver/driver-document.model');
const DriverAttendance = require('../../models/driver/driver-attendance.model');
const DriverPayment = require('../../models/driver/driver-payment.model');
const DriverPaymentLock = require('../../models/driver/driver-payment-lock.model');
const { UserAccount } = require('../../models/auth/user-account.model');
const { Trip } = require('../../models/trips/trip.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const todayUtc = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const normalizeDay = (value) => {
    const date = new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

async function findDriver(id, filter = {}) {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid driver ID.', 400);
    const driver = await Driver.findOne({ _id: id, isDeleted: false, ...filter });
    if (!driver) throw serviceError('Driver not found.', 404);
    return driver;
}

async function nextDriverCode() {
    const year = new Date().getUTCFullYear();
    const counterId = `driver-${year}`;
    let counter;
    try {
        counter = await Driver.CodeCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        if (error.code !== 11000) throw error;
        counter = await Driver.CodeCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true }
        );
    }
    return `DRV-${year}-${String(counter.value).padStart(6, '0')}`;
}

function actorId(actor) {
    return String(actor.id);
}

function dateFilter(query, field) {
    const filter = {};
    if (query.startDate || query.endDate) {
        filter[field] = {};
        if (query.startDate) filter[field].$gte = query.startDate;
        if (query.endDate) {
            const end = new Date(query.endDate);
            end.setUTCHours(23, 59, 59, 999);
            filter[field].$lte = end;
        }
    }
    return filter;
}

async function listRecords(Model, query, actor, options = {}) {
    const filter = { isDeleted: false };
    if (actor.role === 'driver') filter.driverId = actor.id;
    else if (query.driverId) filter.driverId = query.driverId;
    if (query.status && options.statusField) filter[options.statusField] = query.status;
    if (query.status && options.statusFilter) {
        delete filter[options.statusField];
        options.statusFilter(filter, query.status);
    }
    Object.assign(filter, dateFilter(query, options.dateField || 'createdAt'));
    if (query.search && options.searchFields?.length) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = options.searchFields.map((field) => ({ [field]: pattern }));
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        Model.find(filter)
            .sort(options.sort || { createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        Model.countDocuments(filter)
    ]);
    const records = options.mapRecord ? data.map(options.mapRecord) : data;
    return { data: records, pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
}

function duplicateError(error, label) {
    if (error?.code === 11000) throw serviceError(`${label} is already in use.`, 409);
}

function mergeNested(document, changes, keys) {
    for (const key of keys) {
        if (!Object.hasOwn(changes, key)) continue;
        if (changes[key] && typeof changes[key] === 'object' && !Array.isArray(changes[key])) {
            document.set(key, { ...(document.get(key)?.toObject?.() || document.get(key) || {}), ...changes[key] });
        } else {
            document.set(key, changes[key]);
        }
    }
}

function licenseStatus(expiryDate, requestedStatus) {
    if (requestedStatus === 'UnderReview') return 'UnderReview';
    const expiry = normalizeDay(expiryDate);
    const today = todayUtc();
    if (expiry < today) return 'Expired';
    const daysRemaining = Math.ceil((expiry - today) / 86400000);
    return daysRemaining <= 30 ? 'ExpiringSoon' : 'Valid';
}

async function requireActiveDriver(driverId) {
    return findDriver(driverId);
}

async function withDriverPaymentLock(driverId, work) {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + 30000);
    try {
        const lock = await DriverPaymentLock.findOneAndUpdate(
            { _id: driverId, lockedUntil: { $lte: now } },
            { $set: { lockedUntil } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        if (!lock) throw serviceError('Another payroll update is in progress for this driver. Try again shortly.', 409);
    } catch (error) {
        if (error?.code === 11000) {
            throw serviceError('Another payroll update is in progress for this driver. Try again shortly.', 409);
        }
        throw error;
    }

    try {
        return await work();
    } finally {
        await DriverPaymentLock.updateOne({ _id: driverId, lockedUntil }, { $set: { lockedUntil: new Date(0) } });
    }
}

exports.listDrivers = async (query) => {
    const filter = { isDeleted: false };
    if (query.driverStatus) filter.driverStatus = query.driverStatus;
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [
            { driverCode: pattern },
            { 'personalInfo.fullName': pattern },
            { 'contactInfo.phone': pattern },
            { 'contactInfo.email': pattern }
        ];
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        Driver.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(query.limit).lean(),
        Driver.countDocuments(filter)
    ]);
    return { data, pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
};

exports.getDriver = async (id) => (await findDriver(id)).toObject();

exports.createDriver = async (data, actor) => {
    try {
        const driverStatus = data.driverStatus || 'Available';
        const driver = await Driver.create({
            ...data,
            driverCode: await nextDriverCode(),
            statusHistory: [{
                status: driverStatus,
                remarks: 'Driver registered.',
                updatedBy: actorId(actor),
                role: actor.role,
                createdAt: new Date()
            }]
        });
        return driver.toObject();
    } catch (error) {
        duplicateError(error, 'Driver code or mobile number');
        throw error;
    }
};

exports.updateDriver = async (id, changes) => {
    const driver = await findDriver(id);
    if (['Assigned', 'OnTrip'].includes(driver.driverStatus)) {
        throw serviceError('Driver details cannot be changed while a trip is assigned or in progress.', 409);
    }
    if (changes.driverStatus && changes.driverStatus !== driver.driverStatus) {
        throw serviceError('Use the driver status endpoint to change a driver status.', 400);
    }
    mergeNested(driver, changes, ['personalInfo', 'contactInfo', 'emergencyContact', 'employmentDetails', 'notes']);
    try {
        await driver.save();
    } catch (error) {
        duplicateError(error, 'Mobile number');
        throw error;
    }
    return driver.toObject();
};

exports.updateDriverStatus = async (id, { driverStatus, remarks = '' }, actor) => {
    const driver = await findDriver(id);
    if (['Assigned', 'OnTrip'].includes(driver.driverStatus)) {
        throw serviceError('Trip operations control the status of an assigned or active driver.', 409);
    }
    driver.driverStatus = driverStatus;
    driver.statusUpdatedAt = new Date();
    driver.statusHistory.push({
        status: driverStatus,
        remarks,
        updatedBy: actorId(actor),
        role: actor.role,
        createdAt: new Date()
    });
    await driver.save();
    if (['Inactive', 'Suspended'].includes(driverStatus)) {
        await UserAccount.updateOne(
            { role: 'driver', profileId: driver._id, status: 'Active' },
            { $set: { status: 'Disabled' }, $inc: { tokenVersion: 1 } }
        );
    }
    return driver.toObject();
};

exports.deleteDriver = async (id, actor) => {
    const driver = await findDriver(id);
    if (['Assigned', 'OnTrip'].includes(driver.driverStatus)) {
        throw serviceError('A driver with an assigned or active trip cannot be removed.', 409);
    }
    driver.isDeleted = true;
    driver.driverStatus = 'Inactive';
    driver.statusUpdatedAt = new Date();
    driver.statusHistory.push({
        status: 'Inactive',
        remarks: 'Driver removed from the active directory.',
        updatedBy: actorId(actor),
        role: actor.role,
        createdAt: new Date()
    });
    await driver.save();
    await UserAccount.deleteOne({ role: 'driver', profileId: driver._id });
    return { message: 'Driver removed from the active directory.' };
};

exports.listLicenses = (query, actor) => {
    const today = todayUtc();
    const thirtyDaysOut = new Date(today.getTime() + 30 * 86400000);
    return listRecords(DriverLicense, query, actor, {
        statusField: 'status',
        dateField: 'expiryDate',
        statusFilter: (filter, status) => {
            if (status === 'UnderReview') filter.status = status;
            else {
                filter.status = { $ne: 'UnderReview' };
                const range = filter.expiryDate || {};
                if (status === 'Expired') filter.expiryDate = { ...range, $lt: today };
                if (status === 'ExpiringSoon') {
                    filter.expiryDate = {
                        $gte: range.$gte > today ? range.$gte : today,
                        $lte: range.$lte < thirtyDaysOut ? range.$lte : thirtyDaysOut
                    };
                }
                if (status === 'Valid') {
                    filter.expiryDate = {
                        ...range,
                        $gt: range.$gt > thirtyDaysOut ? range.$gt : thirtyDaysOut
                    };
                }
            }
        },
        mapRecord: (license) => ({
            ...license,
            status: licenseStatus(license.expiryDate, license.status === 'UnderReview' ? 'UnderReview' : undefined)
        }),
        searchFields: ['licenseNumber'],
        sort: { expiryDate: 1, _id: 1 }
    });
};

exports.createLicense = async (data, actor) => {
    await requireActiveDriver(data.driverId);
    const status = licenseStatus(data.expiryDate, data.status);
    try {
        return (await DriverLicense.create({
            ...data,
            status,
            createdBy: actorId(actor),
            updatedBy: actorId(actor),
            statusHistory: [{ status, updatedBy: actorId(actor), role: actor.role }]
        })).toObject();
    } catch (error) {
        duplicateError(error, 'Licence number');
        throw error;
    }
};

async function findRelated(Model, id, actor, label) {
    if (!mongoose.isValidObjectId(id)) throw serviceError(`Invalid ${label} ID.`, 400);
    const filter = { _id: id, isDeleted: false };
    if (actor.role === 'driver') filter.driverId = actor.id;
    const record = await Model.findOne(filter);
    if (!record) throw serviceError(`${label} not found.`, 404);
    return record;
}

exports.updateLicense = async (id, changes, actor) => {
    const license = await findRelated(DriverLicense, id, actor, 'Licence');
    if (changes.driverId) await requireActiveDriver(changes.driverId);
    const previousStatus = license.status;
    const expiryChanged = changes.expiryDate
        && normalizeDay(changes.expiryDate).getTime() !== normalizeDay(license.expiryDate).getTime();
    if (
        changes.status &&
        ['Expired', 'ExpiringSoon'].includes(changes.status) &&
        !expiryChanged &&
        changes.status !== licenseStatus(license.expiryDate)
    ) {
        throw serviceError('Expired and expiring licence statuses are derived from the expiry date.', 400);
    }
    mergeNested(license, changes, ['driverId', 'licenseNumber', 'licenseType', 'issueDate', 'expiryDate']);
    license.status = changes.status === 'UnderReview'
        ? 'UnderReview'
        : changes.status === 'Valid'
            ? licenseStatus(license.expiryDate)
            : licenseStatus(license.expiryDate, previousStatus === 'UnderReview' ? 'UnderReview' : undefined);
    if (license.status !== previousStatus) {
        license.statusHistory.push({ status: license.status, updatedBy: actorId(actor), role: actor.role });
    }
    license.updatedBy = actorId(actor);
    try {
        await license.save();
    } catch (error) {
        duplicateError(error, 'Licence number');
        throw error;
    }
    return license.toObject();
};

exports.updateLicenseStatus = async (id, { status }, actor) => {
    const license = await findRelated(DriverLicense, id, actor, 'Licence');
    if (status === 'Valid' && licenseStatus(license.expiryDate) !== 'Valid') {
        throw serviceError('An expired or expiring licence cannot be marked Valid.', 409);
    }
    license.status = status === 'UnderReview' ? 'UnderReview' : licenseStatus(license.expiryDate);
    license.updatedBy = actorId(actor);
    license.statusHistory.push({ status: license.status, updatedBy: actorId(actor), role: actor.role });
    await license.save();
    return license.toObject();
};

exports.deleteLicense = async (id, actor) => {
    const license = await findRelated(DriverLicense, id, actor, 'Licence');
    license.isDeleted = true;
    license.updatedBy = actorId(actor);
    await license.save();
    return { message: 'Licence record archived.' };
};

exports.listDocuments = (query, actor) => listRecords(DriverDocument, query, actor, {
    dateField: 'createdAt',
    searchFields: ['documentNumber'],
    sort: { createdAt: -1, _id: -1 }
});

exports.createDocument = async (data, actor) => {
    await requireActiveDriver(data.driverId);
    return (await DriverDocument.create({
        ...data,
        createdBy: actorId(actor),
        updatedBy: actorId(actor)
    })).toObject();
};

exports.updateDocument = async (id, changes, actor) => {
    const document = await findRelated(DriverDocument, id, actor, 'Driver document');
    if (changes.driverId) await requireActiveDriver(changes.driverId);
    mergeNested(document, changes, ['driverId', 'documentType', 'documentNumber', 'issueDate', 'expiryDate', 'fileUrl']);
    document.updatedBy = actorId(actor);
    await document.save();
    return document.toObject();
};

exports.deleteDocument = async (id, actor) => {
    const document = await findRelated(DriverDocument, id, actor, 'Driver document');
    document.isDeleted = true;
    document.updatedBy = actorId(actor);
    await document.save();
    return { message: 'Driver document archived.' };
};

exports.listAttendance = (query, actor) => listRecords(DriverAttendance, query, actor, {
    statusField: 'status',
    dateField: 'attendanceDate',
    sort: { attendanceDate: -1, _id: -1 }
});

exports.createAttendance = async (data, actor) => {
    await requireActiveDriver(data.driverId);
    const attendanceDate = normalizeDay(data.attendanceDate);
    try {
        return (await DriverAttendance.create({
            ...data,
            attendanceDate,
            createdBy: actorId(actor),
            updatedBy: actorId(actor),
            statusHistory: [{ status: data.status, updatedBy: actorId(actor), role: actor.role }]
        })).toObject();
    } catch (error) {
        if (error?.code === 11000) {
            throw serviceError('Attendance record for this driver and date already exists.', 409);
        }
        throw error;
    }
};

exports.updateAttendance = async (id, changes, actor) => {
    const attendance = await findRelated(DriverAttendance, id, actor, 'Attendance record');
    if (changes.driverId) await requireActiveDriver(changes.driverId);
    const oldStatus = attendance.status;
    mergeNested(attendance, changes, ['driverId', 'attendanceDate', 'checkIn', 'checkOut', 'remarks']);
    if (changes.attendanceDate) attendance.attendanceDate = normalizeDay(changes.attendanceDate);
    if (changes.status) attendance.status = changes.status;
    if (attendance.status !== oldStatus) {
        attendance.statusHistory.push({ status: attendance.status, updatedBy: actorId(actor), role: actor.role });
    }
    attendance.updatedBy = actorId(actor);
    try {
        await attendance.save();
    } catch (error) {
        duplicateError(error, 'Attendance record for this driver and date');
        throw error;
    }
    return attendance.toObject();
};

exports.updateAttendanceStatus = async (id, { status }, actor) => {
    const attendance = await findRelated(DriverAttendance, id, actor, 'Attendance record');
    attendance.status = status;
    if (['Absent', 'OnLeave'].includes(status)) {
        attendance.checkIn = '';
        attendance.checkOut = '';
    }
    attendance.updatedBy = actorId(actor);
    attendance.statusHistory.push({ status, updatedBy: actorId(actor), role: actor.role });
    await attendance.save();
    return attendance.toObject();
};

exports.deleteAttendance = async (id, actor) => {
    const attendance = await findRelated(DriverAttendance, id, actor, 'Attendance record');
    attendance.isDeleted = true;
    attendance.updatedBy = actorId(actor);
    await attendance.save();
    return { message: 'Attendance record archived.' };
};

exports.listPayments = (query, actor) => listRecords(DriverPayment, query, actor, {
    statusField: 'status',
    dateField: 'periodStart',
    sort: { periodStart: -1, _id: -1 }
});

exports.createPayment = async (data, actor) => {
    await requireActiveDriver(data.driverId);
    if (data.status && data.status !== 'Draft') {
        throw serviceError('New salary records must start as Draft and follow the approval workflow.', 400);
    }
    return withDriverPaymentLock(data.driverId, async () => {
        const overlapping = await DriverPayment.exists({
            driverId: data.driverId,
            isDeleted: false,
            periodStart: { $lte: data.periodEnd },
            periodEnd: { $gte: data.periodStart }
        });
        if (overlapping) throw serviceError('This pay period overlaps an existing salary record for the driver.', 409);
        const netAmount = data.baseAmount + (data.allowances || 0) - (data.deductions || 0);
        try {
            return (await DriverPayment.create({
                ...data,
                status: data.status || 'Draft',
                netAmount,
                createdBy: actorId(actor),
                updatedBy: actorId(actor),
                statusHistory: [{ status: data.status || 'Draft', updatedBy: actorId(actor), role: actor.role }]
            })).toObject();
        } catch (error) {
            if (error?.code === 11000) throw serviceError('A salary record for this driver and pay period already exists.', 409);
            throw error;
        }
    });
};

exports.updatePayment = async (id, changes, actor) => {
    const payment = await findRelated(DriverPayment, id, actor, 'Salary record');
    if (payment.status !== 'Draft') throw serviceError('Only Draft salary records can be edited.', 409);
    if (changes.status && changes.status !== 'Draft') {
        throw serviceError('Use the salary status endpoint to approve or pay a record.', 400);
    }
    if (changes.driverId && String(changes.driverId) !== String(payment.driverId)) {
        throw serviceError('A Draft salary record cannot be reassigned to another driver.', 400);
    }
    return withDriverPaymentLock(payment.driverId, async () => {
        const currentPayment = await findRelated(DriverPayment, id, actor, 'Salary record');
        if (currentPayment.status !== 'Draft') throw serviceError('Only Draft salary records can be edited.', 409);
        mergeNested(currentPayment, changes, ['periodStart', 'periodEnd', 'baseAmount', 'allowances', 'deductions']);
        if (currentPayment.periodEnd < currentPayment.periodStart) {
            throw serviceError('Pay period end must be on or after its start.', 400);
        }
        currentPayment.netAmount = currentPayment.baseAmount + currentPayment.allowances - currentPayment.deductions;
        if (currentPayment.netAmount < 0) {
            throw serviceError('Deductions cannot exceed base pay plus allowances.', 400);
        }
        const overlapping = await DriverPayment.exists({
            _id: { $ne: currentPayment._id },
            driverId: currentPayment.driverId,
            isDeleted: false,
            periodStart: { $lte: currentPayment.periodEnd },
            periodEnd: { $gte: currentPayment.periodStart }
        });
        if (overlapping) throw serviceError('This pay period overlaps another salary record for the driver.', 409);
        currentPayment.updatedBy = actorId(actor);
        await currentPayment.save();
        return currentPayment.toObject();
    });
};

exports.updatePaymentStatus = async (id, { status }, actor) => {
    const payment = await findRelated(DriverPayment, id, actor, 'Salary record');
    const transitions = {
        Draft: ['Approved', 'OnHold'],
        Approved: ['Paid', 'OnHold'],
        OnHold: ['Draft', 'Approved'],
        Paid: []
    };
    if (!transitions[payment.status].includes(status)) {
        throw serviceError(`Salary status cannot change from ${payment.status} to ${status}.`, 409);
    }
    payment.status = status;
    payment.paidAt = status === 'Paid' ? new Date() : null;
    payment.updatedBy = actorId(actor);
    payment.statusHistory.push({ status, updatedBy: actorId(actor), role: actor.role });
    await payment.save();
    return payment.toObject();
};

exports.deletePayment = async (id, actor) => {
    const payment = await findRelated(DriverPayment, id, actor, 'Salary record');
    if (payment.status !== 'Draft') throw serviceError('Only Draft salary records can be archived.', 409);
    payment.isDeleted = true;
    payment.updatedBy = actorId(actor);
    await payment.save();
    return { message: 'Draft salary record archived.' };
};

exports.getPerformance = async (query) => {
    const match = { isDeleted: false };
    Object.assign(match, dateFilter(query, 'attendanceDate'));
    const tripMatch = {};
    if (query.startDate || query.endDate) {
        tripMatch.scheduledAt = {};
        if (query.startDate) tripMatch.scheduledAt.$gte = query.startDate;
        if (query.endDate) {
            const end = new Date(query.endDate);
            end.setUTCHours(23, 59, 59, 999);
            tripMatch.scheduledAt.$lte = end;
        }
    }
    const [attendance, totalDrivers, trips] = await Promise.all([
        DriverAttendance.aggregate([
            { $match: match },
            { $group: {
                _id: null,
                records: { $sum: 1 },
                presentDays: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
                absentDays: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
                halfDays: { $sum: { $cond: [{ $eq: ['$status', 'HalfDay'] }, 1, 0] } },
                leaveDays: { $sum: { $cond: [{ $eq: ['$status', 'OnLeave'] }, 1, 0] } }
            } },
            { $project: { _id: 0, records: 1, presentDays: 1, absentDays: 1, halfDays: 1, leaveDays: 1 } }
        ]),
        Driver.countDocuments({ isDeleted: false }),
        Trip.aggregate([
            { $match: tripMatch },
            { $group: {
                _id: null,
                totalTrips: { $sum: 1 },
                completedTrips: { $sum: { $cond: [{ $eq: ['$tripStatus', 'Completed'] }, 1, 0] } },
                delayedTrips: { $sum: { $cond: [{ $eq: ['$tripStatus', 'Delayed'] }, 1, 0] } },
                cancelledTrips: { $sum: { $cond: [{ $eq: ['$tripStatus', 'Cancelled'] }, 1, 0] } }
            } }
        ])
    ]);
    const totals = attendance[0] || { records: 0, presentDays: 0, absentDays: 0, halfDays: 0, leaveDays: 0 };
    const tripTotals = trips[0] || { totalTrips: 0, completedTrips: 0, delayedTrips: 0, cancelledTrips: 0 };
    const scheduledDays = totals.records - totals.leaveDays;
    const attendedDays = totals.presentDays + totals.halfDays * 0.5;
    return {
        summary: {
            totalDrivers,
            attendanceRecords: totals.records,
            presentDays: totals.presentDays,
            absentDays: totals.absentDays,
            halfDays: totals.halfDays,
            leaveDays: totals.leaveDays,
            attendanceRate: scheduledDays ? Number(((attendedDays / scheduledDays) * 100).toFixed(2)) : 0,
            ...tripTotals
        },
        scope: 'Attendance and trip status totals; GPS-based distance, delivery punctuality, and route efficiency require GPS tracking.'
    };
};
