const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'doctor', 'patient'], // Define possible roles
        default: 'patient', // Default role for new registrations
        required: true
    },
    // Common fields for all users (can expand later)
    fullName: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true, // Allows null values, but ensures uniqueness if not null
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address']
    },
    // Doctor-specific fields
    specialty: {
        type: String,
        required: function() { return this.role === 'doctor'; } // Required only if role is 'doctor'
    },
    contactNumber: {
        type: String,
        trim: true
    },
    // Patient-specific fields
    dateOfBirth: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other']
    },
    address: {
        type: String,
        trim: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

// --- Mongoose Middleware for Password Hashing ---
// This pre-save hook will hash the password before saving a new user or updating a password
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) { // Only hash if the password has been modified (or is new)
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10); // Generate a salt
        this.password = await bcrypt.hash(this.password, salt); // Hash the password
        next();
    } catch (error) {
        next(error); // Pass error to the next middleware
    }
});

// --- Method to Compare Passwords ---
// This method will be available on user documents to compare provided password with hashed password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;