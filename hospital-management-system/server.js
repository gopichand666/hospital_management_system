// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Ensure these models are correctly imported
const User = require('./models/User');
const Leave = require('./models/Leave'); // Assuming you have this model
const Appointment = require('./models/Appointment'); // Assuming you have this model

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// --- Middleware ---
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory

// --- MongoDB Connection ---
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Authentication and Authorization Middleware ---
const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token'); // Get token from header
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Verify token
        req.user = decoded.user; // Attach decoded user payload (id, username, role) to request
        next(); // Pass control to the next middleware/route handler
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' }); // Token is invalid or expired
    }
};

// Role-specific authorization middleware
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ msg: 'Access denied: Not an Admin' });
    }
};

const isDoctor = (req, res, next) => {
    if (req.user && req.user.role === 'doctor') {
        next();
    } else {
        res.status(403).json({ msg: 'Access denied: Not a Doctor' });
    }
};

const isPatient = (req, res, next) => {
    if (req.user && req.user.role === 'patient') {
        next();
    } else {
        res.status(403).json({ msg: 'Access denied: Not a Patient' });
    }
};

// --- Helper function for User Login ---
const loginUser = async (req, res, expectedRole = null) => {
    const { username, password } = req.body;

    try {
        // Find user by username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // If an expected role is specified, check if the user's role matches
        if (expectedRole && user.role !== expectedRole) {
            return res.status(403).json({ msg: `Access denied. Not a ${expectedRole}.` });
        }

        // Compare provided password with hashed password in DB
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Create JWT payload
        const payload = {
            user: {
                id: user.id, // Mongoose virtual 'id' for _id
                username: user.username,
                role: user.role
            }
        };

        // Sign the token
        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '1h' }, // Token expires in 1 hour
            (err, token) => {
                if (err) throw err; // Handle JWT signing error
                // Send token, role, and user details back to the client
                res.json({ token, role: user.role, userId: user.id, username: user.username, fullName: user.fullName });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};


// --- API Routes ---

// Temporary Initial Admin Setup Route (REMOVE IN PRODUCTION after first admin is created)
app.post('/api/setup/initial-admin', async (req, res) => {
    const { username, password, fullName, email } = req.body;
    try {
        // Prevent creating multiple admins via this route
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(400).json({ msg: 'Admin user already exists. Cannot create another via this setup route.' });
        }

        const newAdmin = new User({
            username,
            password,
            role: 'admin',
            fullName,
            email
        });

        await newAdmin.save();
        res.status(201).json({ msg: 'Initial Admin user created successfully!' });

    } catch (err) {
        console.error(err.message);
        if (err.name === 'ValidationError') {
            let errors = {};
            Object.keys(err.errors).forEach((key) => {
                errors[key] = err.errors[key].message;
            });
            return res.status(400).json({ msg: 'Validation Error', errors });
        }
        res.status(500).send('Server error');
    }
});

// Generic Login Route (used by Admin Login now)
app.post('/api/auth/login', (req, res) => loginUser(req, res));


// --- ADMIN PORTAL API ROUTES ---

// Route to Add a new Doctor (Admin only)
app.post('/api/admin/doctors', authMiddleware, isAdmin, async (req, res) => {
    const { fullName, username, email, password, specialty, contactNumber } = req.body;
    try {
        // Check if username or email already exists
        let user = await User.findOne({ username });
        if (user) { return res.status(400).json({ msg: 'Username already exists' }); }
        user = await User.findOne({ email });
        if (email && user) { return res.status(400).json({ msg: 'Email already registered' }); }

        const newDoctor = new User({ fullName, username, email, password, role: 'doctor', specialty, contactNumber });
        await newDoctor.save();
        res.status(201).json({ msg: 'Doctor added successfully', doctor: newDoctor });
    } catch (err) {
        console.error(err.message);
        if (err.name === 'ValidationError') {
            let errors = {}; Object.keys(err.errors).forEach((key) => { errors[key] = err.errors[key].message; });
            return res.status(400).json({ msg: 'Validation Error', errors });
        }
        res.status(500).send('Server error');
    }
});

// Route to Get all Doctors (Admin only)
app.get('/api/admin/doctors', authMiddleware, isAdmin, async (req, res) => {
    try {
        const doctors = await User.find({ role: 'doctor' }).select('-password'); // Exclude password
        res.json(doctors);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Route to Delete a Doctor by ID (Admin only)
app.delete('/api/admin/doctors/:id', authMiddleware, isAdmin, async (req, res) => {
    try {
        // Find and delete doctor by ID and ensure role is 'doctor'
        const doctor = await User.findOneAndDelete({ _id: req.params.id, role: 'doctor' });
        if (!doctor) { return res.status(404).json({ msg: 'Doctor not found' }); }
        res.json({ msg: 'Doctor removed successfully' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') { return res.status(400).json({ msg: 'Invalid Doctor ID' }); }
        res.status(500).send('Server error');
    }
});

// Route to Get all Leave Requests (Admin only)
app.get('/api/admin/leaves', authMiddleware, isAdmin, async (req, res) => {
    try {
        // Populate doctor details for display
        const leaves = await Leave.find().populate('doctor', 'fullName username email specialty');
        res.json(leaves);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Route to Update Leave Request Status (Approve/Reject) (Admin only)
app.put('/api/admin/leaves/:id', authMiddleware, isAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        const leave = await Leave.findById(req.params.id);
        if (!leave) { return res.status(404).json({ msg: 'Leave request not found' }); }
        // Validate incoming status
        if (!['Approved', 'Rejected'].includes(status)) { return res.status(400).json({ msg: 'Invalid status provided' }); }

        leave.status = status;
        leave.approvedBy = req.user.id; // Record which admin approved/rejected
        leave.approvalDate = Date.now();
        await leave.save();
        res.json({ msg: `Leave request ${status} successfully`, leave });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') { return res.status(400).json({ msg: 'Invalid Leave ID' }); }
        res.status(500).send('Server error');
    }
});

// Route for Admin to View All Appointments (Admin only)
app.get('/api/admin/appointments', authMiddleware, isAdmin, async (req, res) => {
    try {
        // Populate patient and doctor details for display
        const appointments = await Appointment.find()
            .populate('patient', 'fullName username email')
            .populate('doctor', 'fullName username specialty');
        res.json(appointments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Route for Admin to Update Appointment Status (Admin only)
app.put('/api/admin/appointments/:id/status', authMiddleware, isAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) { return res.status(404).json({ msg: 'Appointment not found' }); }
        // Validate incoming status
        if (!['Confirmed', 'Cancelled', 'Completed'].includes(status)) { return res.status(400).json({ msg: 'Invalid status provided' }); }

        appointment.status = status;
        await appointment.save();
        res.json({ msg: `Appointment status updated to ${status}`, appointment });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') { return res.status(400).json({ msg: 'Invalid Appointment ID' }); }
        res.status(500).send('Server error');
    }
});


// --- DOCTOR PORTAL API ROUTES ---

// Route for Doctor to Login
app.post('/api/doctor/login', (req, res) => loginUser(req, res, 'doctor'));

// Route for Doctor to Apply for Leave (Doctor only)
app.post('/api/doctor/leaves', authMiddleware, isDoctor, async (req, res) => {
    const { leaveType, startDate, endDate, reason } = req.body;
    const doctorId = req.user.id; // Get doctor ID from authenticated token
    try {
        const newLeave = new Leave({ doctor: doctorId, leaveType, startDate, endDate, reason });
        await newLeave.save();
        res.status(201).json({ msg: 'Leave request submitted successfully', leave: newLeave });
    } catch (err) {
        console.error(err.message);
        if (err.name === 'ValidationError') {
            let errors = {}; Object.keys(err.errors).forEach((key) => { errors[key] = err.errors[key].message; });
            return res.status(400).json({ msg: 'Validation Error', errors });
        }
        res.status(500).send('Server error');
    }
});

// Route for Doctor to View Their Own Leave Requests (Doctor only)
app.get('/api/doctor/leaves', authMiddleware, isDoctor, async (req, res) => {
    try {
        const doctorId = req.user.id;
        // Fetch leaves only for the logged-in doctor, sorted by request date
        const leaves = await Leave.find({ doctor: doctorId }).sort({ requestedAt: -1 });
        res.json(leaves);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Route for Doctor to View Their Own Appointments (Doctor only)
app.get('/api/doctor/appointments', authMiddleware, isDoctor, async (req, res) => {
    try {
        const doctorId = req.user.id;
        // Fetch appointments only for the logged-in doctor, populate patient info
        const appointments = await Appointment.find({ doctor: doctorId })
            .populate('patient', 'fullName username email contactNumber')
            .sort({ date: 1, time: 1 }); // Sort by date and time
        res.json(appointments);
    } catch (err) {
        console.error(err.message);
        if (err.name === 'ValidationError') {
            let errors = {}; Object.keys(err.errors).forEach((key) => { errors[key] = err.errors[key].message; });
            return res.status(400).json({ msg: 'Validation Error', errors });
        }
        res.status(500).send('Server error');
    }
});

// Route for Doctor to Update Appointment Status (Doctor only)
app.put('/api/doctor/appointments/:id/status', authMiddleware, isDoctor, async (req, res) => {
    const { status } = req.body;
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) { return res.status(404).json({ msg: 'Appointment not found' }); }
        // Security: Ensure the doctor can only update their own appointments
        if (appointment.doctor.toString() !== req.user.id) { return res.status(403).json({ msg: 'Not authorized to update this appointment.' }); }
        // Validate incoming status for doctor's actions
        if (!['Confirmed', 'Cancelled', 'Completed'].includes(status)) { return res.status(400).json({ msg: 'Invalid status provided' }); }

        appointment.status = status;
        await appointment.save();
        res.json({ msg: `Appointment status updated to ${status}`, appointment });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') { return res.status(400).json({ msg: 'Invalid Appointment ID' }); }
        res.status(500).send('Server error');
    }
});


// --- PATIENT PORTAL API ROUTES ---

// Patient Registration Route
app.post('/api/patient/register', async (req, res) => {
    const { fullName, username, email, password, dateOfBirth, gender, address } = req.body;
    try {
        // Check if username or email already exists
        let user = await User.findOne({ username });
        if (user) { return res.status(400).json({ msg: 'Username already exists' }); }
        
        user = await User.findOne({ email });
        if (email && user) { return res.status(400).json({ msg: 'Email already registered' }); }

        // Create new patient user
        user = new User({ fullName, username, email, password, role: 'patient', dateOfBirth, gender, address });
        await user.save();

        // Generate token for auto-login after registration
        const payload = { user: { id: user.id, username: user.username, role: user.role } };
        jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.status(201).json({ msg: 'Patient registered successfully', token, role: user.role, userId: user.id, username: user.username, fullName: user.fullName });
        });
    } catch (err) {
        console.error(err.message);
        // Check for duplicate key error from MongoDB
        if (err.code === 11000) {
            return res.status(400).json({ msg: 'Username or email is already in use.' });
        }
        // Check for Mongoose validation errors
        if (err.name === 'ValidationError') {
            let errors = {};
            Object.keys(err.errors).forEach((key) => {
                errors[key] = err.errors[key].message;
            });
            return res.status(400).json({ msg: 'Validation Error', errors });
        }
        // For all other errors, send a generic server error
        res.status(500).send('Server error');
    }
});
// Patient Login Route
app.post('/api/patient/login', (req, res) => loginUser(req, res, 'patient'));

// Route for Patient to Book an Appointment (Patient only)
app.post('/api/patient/appointments', authMiddleware, isPatient, async (req, res) => {
    const { doctorId, date, time, reason } = req.body;
    const patientId = req.user.id; // Get patient ID from authenticated token
    try {
        // Verify doctor exists and is indeed a doctor
        const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
        if (!doctor) { return res.status(404).json({ msg: 'Selected doctor not found or is not a doctor.' }); }

        // Create new appointment
        const newAppointment = new Appointment({ patient: patientId, doctor: doctorId, date: new Date(date), time, reason, status: 'Pending' });
        await newAppointment.save(); // Mongoose validation will run here
        res.status(201).json({ msg: 'Appointment booked successfully and is pending confirmation!', appointment: newAppointment });
    } catch (err) {
        console.error(err.message);
        if (err.name === 'ValidationError') {
            let errors = {}; Object.keys(err.errors).forEach((key) => { errors[key] = err.errors[key].message; });
            return res.status(400).json({ msg: 'Validation Error', errors });
        }
        res.status(500).send('Server error');
    }
});

// Route for Patient to View Their Own Appointments (Patient only)
app.get('/api/patient/appointments', authMiddleware, isPatient, async (req, res) => {
    try {
        const patientId = req.user.id;
        // Fetch appointments for the logged-in patient, populate doctor details
        const appointments = await Appointment.find({ patient: patientId })
            .populate('doctor', 'fullName specialty email contactNumber')
            .sort({ date: 1, time: 1 }); // Sort by date and time
        res.json(appointments);
    } catch (err) {
        console.error(err.message);
        if (err.name === 'ValidationError') { // Less likely here, but good to keep
            let errors = {}; Object.keys(err.errors).forEach((key) => { errors[key] = err.errors[key].message; });
            return res.status(400).json({ msg: 'Validation Error', errors });
        }
        res.status(500).send('Server error');
    }
});

// Route for Patient to View All Doctor Details (Patient only)
app.get('/api/patient/doctors', authMiddleware, isPatient, async (req, res) => {
    try {
        // Fetch all doctors, selecting only public fields
        const doctors = await User.find({ role: 'doctor' }).select('fullName specialty email contactNumber');
        res.json(doctors);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Route for Patient to Update Their Own Appointment Status (Cancel)
app.put('/api/patient/appointments/:id/status', authMiddleware, isPatient, async (req, res) => {
    const { status } = req.body; // Expects 'Cancelled'
    try {
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return res.status(404).json({ msg: 'Appointment not found' });
        }

        // Security: Ensure patient can only cancel THEIR OWN appointments
        if (appointment.patient.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized to update this appointment.' });
        }

        // Validation: Allow only 'Cancelled' status for patient updates via this route
        if (status !== 'Cancelled') {
            return res.status(400).json({ msg: 'Invalid status provided. Patients can only cancel appointments.' });
        }

        // Prevent cancelling appointments that are already completed or cancelled
        if (appointment.status === 'Cancelled' || appointment.status === 'Completed') {
            return res.status(400).json({ msg: `Appointment is already ${appointment.status}. Cannot cancel.` });
        }

        appointment.status = status;
        await appointment.save();
        res.json({ msg: `Appointment ${status.toLowerCase()} successfully!`, appointment });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ msg: 'Invalid Appointment ID' });
        }
        res.status(500).send('Server error');
    }
});


// --- User Profile Route (Common for all authenticated users) ---
app.get('/api/user/me', authMiddleware, async (req, res) => {
    try {
        // Fetch user profile excluding password
        const user = await User.findById(req.user.id).select('-password');
        if (!user) { return res.status(404).json({ msg: 'User not found' }); }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// --- Frontend Route Serving ---
// These routes serve the HTML files, protected by authentication middleware
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/admin-login.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin-login.html')); });
app.get('/doctor-login.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'doctor-login.html')); });
app.get('/patient-login.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'patient-login.html')); });

app.get('/admin-dashboard.html', authMiddleware, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});
app.get('/doctor-dashboard.html', authMiddleware, isDoctor, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'doctor-dashboard.html'));
});
app.get('/patient-dashboard.html', authMiddleware, isPatient, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'patient-dashboard.html'));
});


// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
    console.log(`Admin Dashboard (PROTECTED): http://localhost:${PORT}/admin-dashboard.html`);
    console.log(`Doctor Dashboard (PROTECTED): http://localhost:${PORT}/doctor-dashboard.html`);
    console.log(`Patient Dashboard (PROTECTED): http://localhost:${PORT}/patient-dashboard.html`);
    console.log(`Admin Setup API (Temporary): POST http://localhost:${PORT}/api/setup/initial-admin`);
});
