const mongoose = require('mongoose');

const driverAttendanceSchema = new mongoose.Schema({
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    attendanceDate: { type: Date, required: true },
    status: { type: String, required: true, enum: ['Present', 'Absent', 'OnLeave', 'HalfDay'] },
    checkIn: { type: String, trim: true, default: '' },
    checkOut: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '', maxlength: 1000 },
    statusHistory: [{
        status: { type: String, required: true, enum: ['Present', 'Absent', 'OnLeave', 'HalfDay'] },
        updatedBy: { type: String, required: true },
        role: { type: String, required: true, enum: ['admin', 'manager'] },
        createdAt: { type: Date, required: true, default: Date.now }
    }],
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true }
}, { timestamps: true, versionKey: false });

driverAttendanceSchema.index({ driverId: 1, attendanceDate: 1 }, { unique: true });
driverAttendanceSchema.index({ attendanceDate: -1, status: 1 });

module.exports = mongoose.model('DriverAttendance', driverAttendanceSchema);
