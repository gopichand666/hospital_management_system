const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
    doctor: {
        type: mongoose.Schema.Types.ObjectId, // Reference to the Doctor (User) who applied for leave
        ref: 'User', // Refers to the 'User' model
        required: true
    },
    leaveType: {
        type: String,
        enum: ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity/Paternity Leave', 'Other'],
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    approvedBy: { // Admin who approved/rejected the leave
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvalDate: {
        type: Date
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Custom validation to ensure end date is not before start date
LeaveSchema.path('endDate').validate(function(value) {
    return this.startDate <= value;
}, 'End date must be on or after the start date.');


const Leave = mongoose.model('Leave', LeaveSchema);

module.exports = Leave;