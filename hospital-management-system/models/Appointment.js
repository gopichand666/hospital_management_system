const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Refers to the 'User' model (patient)
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Refers to the 'User' model (doctor)
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    time: { // Store time as a string (e.g., "09:00", "14:30")
        type: String,
        required: true,
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please use HH:MM format for time']
    },
    reason: {
        type: String,
        trim: true,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Custom validation to ensure appointment date is in the future
AppointmentSchema.path('date').validate(function(value) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    return value >= today;
}, 'Appointment date must be in the future.');

// Pre-save hook to update `updatedAt` field
AppointmentSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Appointment = mongoose.model('Appointment', AppointmentSchema);

module.exports = Appointment;