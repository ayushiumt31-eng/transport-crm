const mongoose = require('mongoose');
const FleetVehicle = require('../../models/fleet/vehicle.model');
const { MaintenanceRecord, MaintenanceCounter } = require('../../models/maintenance/maintenance-record.model');
const { Trip } = require('../../models/trips/trip.model');
const { VehicleAllocation } = require('../../models/fleet/vehicle-allocation.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const ACTIVE_TRIP_STATUSES = ['Scheduled', 'Assigned', 'Starting', 'InProgress', 'Delayed', 'Completing', 'Cancelling'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toPaise(amount) {
    const paise = Math.round(amount * 100);
    if (!Number.isSafeInteger(paise)) throw serviceError('Maintenance cost is outside the supported range.', 400);
    return paise;
}

async function nextRecordNumber() {
    const year = new Date().getUTCFullYear();
    const counterId = `maintenance-${year}`;
    let counter;
    try {
        counter = await MaintenanceCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        if (error?.code !== 11000) throw error;
        counter = await MaintenanceCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true }
        );
    }
    return `MNT-${year}-${String(counter.value).padStart(6, '0')}`;
}

function dateParts(date) {
    return [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
}

function addDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function publicRecord(record) {
    return {
        ...record,
        estimatedCost: record.estimatedCostPaise == null ? null : record.estimatedCostPaise / 100,
        actualCost: record.actualCostPaise == null ? null : record.actualCostPaise / 100
    };
}

function addHistory(status, actor, remarks = '') {
    return {
        status,
        remarks,
        updatedBy: String(actor.id),
        role: actor.role,
        createdAt: new Date()
    };
}

function populatedRecords(query) {
    return query.populate('vehicleId', 'registrationNumber vehicleType manufacturer model vehicleStatus lastFuelOdometerKm');
}

exports.listVehicleOptions = async (query) => {
    const filter = { isDeleted: false };
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [{ registrationNumber: pattern }, { manufacturer: pattern }, { model: pattern }];
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        FleetVehicle.find(filter)
            .select('registrationNumber vehicleType manufacturer model vehicleStatus lastFuelOdometerKm documents')
            .sort({ registrationNumber: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        FleetVehicle.countDocuments(filter)
    ]);
    return { data, pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
};

exports.createRecord = async (data, actor) => {
    const vehicle = await FleetVehicle.findOne({ _id: data.vehicleId, isDeleted: false }).select('_id').lean();
    if (!vehicle) throw serviceError('Vehicle not found.', 404);
    const record = await MaintenanceRecord.create({
        recordNumber: await nextRecordNumber(),
        ...data,
        vehicleId: data.vehicleId,
        scheduledAt: new Date(data.scheduledAt),
        dueOdometerKm: data.dueOdometerKm ?? null,
        estimatedCostPaise: data.estimatedCost == null ? null : toPaise(data.estimatedCost),
        statusHistory: [addHistory('Scheduled', actor, 'Maintenance scheduled.')],
        createdBy: String(actor.id),
        createdByRole: actor.role
    });
    await record.populate('vehicleId', 'registrationNumber vehicleType vehicleStatus');
    return publicRecord(record.toObject());
};

exports.listRecords = async (query) => {
    const filter = {};
    if (query.vehicleId) filter.vehicleId = query.vehicleId;
    if (query.recordType) filter.recordType = query.recordType;
    if (query.status) filter.status = query.status;
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [{ recordNumber: pattern }, { title: pattern }, { vendor: pattern }, { description: pattern }];
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        populatedRecords(MaintenanceRecord.find(filter).sort({ scheduledAt: -1, _id: -1 }).skip(skip).limit(query.limit)).lean(),
        MaintenanceRecord.countDocuments(filter)
    ]);
    return {
        data: data.map(publicRecord),
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

async function canStartVehicleMaintenance(vehicleId) {
    const [trip, allocation] = await Promise.all([
        Trip.exists({ vehicleId, tripStatus: { $in: ACTIVE_TRIP_STATUSES } }),
        VehicleAllocation.exists({ vehicleId, allocationStatus: 'Allocated' })
    ]);
    return !trip && !allocation;
}

exports.updateRecordStatus = async (id, data, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid maintenance record ID.', 400);
    const record = await MaintenanceRecord.findById(id);
    if (!record) throw serviceError('Maintenance record not found.', 404);

    if (data.status === 'InProgress') {
        if (record.status !== 'Scheduled') throw serviceError('Only scheduled maintenance can be started.', 409);
        const available = await canStartVehicleMaintenance(record.vehicleId);
        if (!available) throw serviceError('Release the vehicle from its active trip or allocation before starting maintenance.', 409);
        const updatedVehicle = await FleetVehicle.findOneAndUpdate(
            { _id: record.vehicleId, isDeleted: false, vehicleStatus: 'Available' },
            {
                $set: { vehicleStatus: 'UnderMaintenance', statusUpdatedAt: new Date() },
                $push: {
                    statusHistory: {
                        status: 'UnderMaintenance',
                        remarks: `Maintenance ${record.recordNumber} started.`,
                        updatedBy: String(actor.id),
                        role: actor.role,
                        createdAt: new Date()
                    }
                }
            },
            { new: true, runValidators: true }
        );
        if (!updatedVehicle) throw serviceError('Vehicle availability changed. Refresh and retry.', 409);
        const updatedRecord = await MaintenanceRecord.findOneAndUpdate(
            { _id: record._id, status: 'Scheduled' },
            { $set: { status: 'InProgress' }, $push: { statusHistory: addHistory('InProgress', actor, data.remarks) } },
            { new: true, runValidators: true }
        );
        if (!updatedRecord) {
            await FleetVehicle.findOneAndUpdate(
                { _id: record.vehicleId, vehicleStatus: 'UnderMaintenance' },
                {
                    $set: { vehicleStatus: 'Available', statusUpdatedAt: new Date() },
                    $push: {
                        statusHistory: {
                            status: 'Available',
                            remarks: `Maintenance start rolled back for ${record.recordNumber}.`,
                            updatedBy: String(actor.id),
                            role: actor.role,
                            createdAt: new Date()
                        }
                    }
                }
            );
            throw serviceError('Maintenance record changed in another request. Refresh and retry.', 409);
        }
        await updatedRecord.populate('vehicleId', 'registrationNumber vehicleType vehicleStatus lastFuelOdometerKm');
        return publicRecord(updatedRecord.toObject());
    }

    if (data.status === 'Completed') {
        if (record.status !== 'InProgress') throw serviceError('Only in-progress maintenance can be completed.', 409);
        const vehicle = await FleetVehicle.findOne({ _id: record.vehicleId, isDeleted: false }).select('vehicleStatus lastFuelOdometerKm').lean();
        if (!vehicle) throw serviceError('Vehicle not found.', 404);
        if (vehicle.vehicleStatus !== 'UnderMaintenance') throw serviceError('Vehicle is no longer marked under maintenance.', 409);
        if (vehicle.lastFuelOdometerKm != null && data.completionOdometerKm < vehicle.lastFuelOdometerKm) {
            throw serviceError('Completion odometer cannot be below the latest recorded fuel odometer.', 400);
        }
        const completedAt = new Date();
        const updatedRecord = await MaintenanceRecord.findOneAndUpdate(
            { _id: record._id, status: 'InProgress' },
            {
                $set: {
                    status: 'Completed',
                    completedAt,
                    completionOdometerKm: data.completionOdometerKm,
                    actualCostPaise: toPaise(data.actualCost),
                    completionRemarks: data.completionRemarks || ''
                },
                $push: { statusHistory: addHistory('Completed', actor, data.completionRemarks || data.remarks) }
            },
            { new: true, runValidators: true }
        );
        if (!updatedRecord) throw serviceError('Maintenance record changed in another request. Refresh and retry.', 409);
        const updatedVehicle = await FleetVehicle.findOneAndUpdate(
            { _id: record.vehicleId, isDeleted: false, vehicleStatus: 'UnderMaintenance' },
            {
                $set: { vehicleStatus: 'Available', statusUpdatedAt: completedAt },
                $push: {
                    statusHistory: {
                        status: 'Available',
                        remarks: `Maintenance ${record.recordNumber} completed.`,
                        updatedBy: String(actor.id),
                        role: actor.role,
                        createdAt: completedAt
                    }
                }
            },
            { new: true, runValidators: true }
        );
        if (!updatedVehicle) {
            await MaintenanceRecord.findOneAndUpdate(
                { _id: record._id, status: 'Completed' },
                {
                    $set: { status: 'InProgress', completedAt: null, completionOdometerKm: null, actualCostPaise: null, completionRemarks: '' },
                    $push: { statusHistory: addHistory('InProgress', actor, 'Completion rolled back because vehicle status changed.') }
                }
            );
            throw serviceError('Vehicle status changed during maintenance completion. Refresh and retry.', 409);
        }
        await updatedRecord.populate('vehicleId', 'registrationNumber vehicleType vehicleStatus lastFuelOdometerKm');
        return publicRecord(updatedRecord.toObject());
    }

    if (data.status === 'Cancelled') {
        if (record.status !== 'Scheduled') throw serviceError('Only scheduled maintenance can be cancelled.', 409);
        const updatedRecord = await MaintenanceRecord.findOneAndUpdate(
            { _id: record._id, status: 'Scheduled' },
            { $set: { status: 'Cancelled' }, $push: { statusHistory: addHistory('Cancelled', actor, data.remarks) } },
            { new: true, runValidators: true }
        );
        if (!updatedRecord) throw serviceError('Maintenance record changed in another request. Refresh and retry.', 409);
        await updatedRecord.populate('vehicleId', 'registrationNumber vehicleType vehicleStatus lastFuelOdometerKm');
        return publicRecord(updatedRecord.toObject());
    }

    throw serviceError('Invalid maintenance status transition.', 400);
};

exports.updateVehicleDocument = async (id, documentType, data, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid vehicle ID.', 400);
    const vehicle = await FleetVehicle.findOneAndUpdate(
        { _id: id, isDeleted: false },
        {
            $set: {
                [`documents.${documentType}`]: {
                    ...data,
                    issueDate: data.issueDate ? new Date(`${data.issueDate}T00:00:00.000Z`) : null,
                    expiryDate: new Date(`${data.expiryDate}T00:00:00.000Z`)
                }
            },
            $push: {
                documentHistory: {
                    documentType,
                    documentNumber: data.documentNumber || '',
                    issueDate: data.issueDate ? new Date(`${data.issueDate}T00:00:00.000Z`) : null,
                    expiryDate: new Date(`${data.expiryDate}T00:00:00.000Z`),
                    updatedBy: String(actor.id),
                    role: actor.role,
                    createdAt: new Date()
                }
            }
        },
        { new: true, runValidators: true }
    ).select('registrationNumber documents');
    if (!vehicle) throw serviceError('Vehicle not found.', 404);
    return vehicle.toObject();
};

exports.listReminders = async (query) => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const until = addDays(today, query.days);
    const skip = (query.page - 1) * query.limit;
    const fetchLimit = skip + query.limit;
    const endOfWindow = new Date(until.getTime() + 86400000 - 1);
    const [documentResult, maintenanceResult] = await Promise.all([
        FleetVehicle.aggregate([
            { $match: { isDeleted: false } },
            {
                $project: {
                    registrationNumber: 1,
                    reminders: [
                        { type: 'DocumentExpiry', title: 'Insurance', documentType: 'insurance', document: '$documents.insurance' },
                        { type: 'DocumentExpiry', title: 'Fitness certificate', documentType: 'fitnessCertificate', document: '$documents.fitnessCertificate' }
                    ]
                }
            },
            { $unwind: '$reminders' },
            {
                $match: {
                    'reminders.document.expiryDate': { $ne: null, $lte: endOfWindow }
                }
            },
            {
                $project: {
                    _id: 0,
                    type: '$reminders.type',
                    title: '$reminders.title',
                    vehicleId: '$_id',
                    registrationNumber: 1,
                    dueAt: '$reminders.document.expiryDate',
                    documentNumber: { $ifNull: ['$reminders.document.documentNumber', ''] },
                    status: {
                        $cond: [
                            { $lt: ['$reminders.document.expiryDate', today] },
                            'Overdue',
                            'DueSoon'
                        ]
                    },
                    daysUntilDue: {
                        $ceil: {
                            $divide: [
                                { $subtract: ['$reminders.document.expiryDate', today] },
                                86400000
                            ]
                        }
                    }
                }
            },
            {
                $facet: {
                    data: [
                        { $sort: { dueAt: 1, registrationNumber: 1, title: 1 } },
                        { $limit: fetchLimit }
                    ],
                    pagination: [{ $count: 'total' }]
                }
            }
        ]),
        MaintenanceRecord.aggregate([
            {
                $match: {
                    status: 'Scheduled',
                    $or: [
                        { scheduledAt: { $lte: endOfWindow } },
                        { dueOdometerKm: { $ne: null } }
                    ]
                }
            },
            {
                $lookup: {
                    from: FleetVehicle.collection.name,
                    let: { vehicleId: '$vehicleId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$_id', '$$vehicleId'] },
                                        { $eq: ['$isDeleted', false] }
                                    ]
                                }
                            }
                        },
                        { $project: { registrationNumber: 1, lastFuelOdometerKm: 1 } }
                    ],
                    as: 'vehicle'
                }
            },
            { $unwind: '$vehicle' },
            {
                $addFields: {
                    odometerDue: {
                        $and: [
                            { $ne: ['$dueOdometerKm', null] },
                            { $ne: ['$vehicle.lastFuelOdometerKm', null] },
                            { $gte: ['$vehicle.lastFuelOdometerKm', '$dueOdometerKm'] }
                        ]
                    }
                }
            },
            {
                $match: {
                    $or: [
                        { scheduledAt: { $lte: endOfWindow } },
                        { odometerDue: true }
                    ]
                }
            },
            {
                $project: {
                    _id: 0,
                    type: { $literal: 'Maintenance' },
                    title: 1,
                    recordId: '$_id',
                    recordNumber: 1,
                    recordType: 1,
                    vehicleId: '$vehicle._id',
                    registrationNumber: '$vehicle.registrationNumber',
                    dueAt: '$scheduledAt',
                    dueOdometerKm: 1,
                    currentOdometerKm: { $ifNull: ['$vehicle.lastFuelOdometerKm', null] },
                    status: {
                        $cond: [
                            {
                                $or: [
                                    { $lt: ['$scheduledAt', today] },
                                    '$odometerDue'
                                ]
                            },
                            'Overdue',
                            'DueSoon'
                        ]
                    }
                }
            },
            {
                $facet: {
                    data: [
                        { $sort: { dueAt: 1, registrationNumber: 1, title: 1 } },
                        { $limit: fetchLimit }
                    ],
                    pagination: [{ $count: 'total' }]
                }
            }
        ])
    ]);
    const documentData = documentResult[0]?.data || [];
    const maintenanceData = maintenanceResult[0]?.data || [];
    const reminders = [...documentData, ...maintenanceData]
        .sort((left, right) => new Date(left.dueAt) - new Date(right.dueAt)
            || left.registrationNumber.localeCompare(right.registrationNumber)
            || left.title.localeCompare(right.title))
        .slice(skip, skip + query.limit);
    const total = (documentResult[0]?.pagination[0]?.total || 0)
        + (maintenanceResult[0]?.pagination[0]?.total || 0);
    return {
        data: reminders,
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.getSummary = async () => {
    const [statusCounts, cost] = await Promise.all([
        MaintenanceRecord.aggregate([
            { $group: { _id: { recordType: '$recordType', status: '$status' }, count: { $sum: 1 } } }
        ]),
        MaintenanceRecord.aggregate([
            { $match: { status: 'Completed' } },
            {
                $group: {
                    _id: '$recordType',
                    completedCount: { $sum: 1 },
                    actualCostPaise: { $sum: { $ifNull: ['$actualCostPaise', 0] } }
                }
            }
        ])
    ]);
    return {
        counts: statusCounts.map((item) => ({ recordType: item._id.recordType, status: item._id.status, count: item.count })),
        completed: cost.map((item) => ({ recordType: item._id, completedCount: item.completedCount, actualCostPaise: item.actualCostPaise }))
    };
};
