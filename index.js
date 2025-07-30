// index.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- In-memory storage for applications (in production, use a database) ---
// Make sure this is declared before the routes that use it
let applications = [];

// --- Helper Functions ---

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    // Get auth header value
    const authHeader = req.headers['authorization'];
    // Check if bearer is undefined
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Access Denied. No Token Provided.' });
    }

    // Get token from "Bearer TOKEN"
    const token = authHeader.split(' ')[1];

    // Check if token is present
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access Denied. Token Missing.' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Add user from payload
        req.user = decoded;
        next();
    } catch (err) {
        // If token is invalid
        res.status(403).json({ success: false, message: 'Invalid Token.' });
    }
};

// --- Serve HTML Pages ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/about.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/merch.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'merch.html'));
});

app.get('/apply.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'apply.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- API Routes ---

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Check credentials against environment variables
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        // Sign a JWT token with the username
        const token = jwt.sign({ username: username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ success: true, token: token });
    } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Get all applications (Protected Route)
// Apply the authenticateToken middleware
app.get('/api/applications', authenticateToken, (req, res) => {
    // If authentication passes, send the applications
    // Wrap in an object for consistency with frontend expectations
    res.json({ success: true, applications: applications });
});

// Submit application (Public Route)
app.post('/api/applications', (req, res) => {
    // Basic validation could be added here if needed
    const newApplication = {
        id: Date.now(), // Simple ID generation, use uuid in production
        ...req.body,
        status: 'pending',
        submittedAt: new Date().toISOString()
    };

    applications.push(newApplication);
    console.log(`New application received (ID: ${newApplication.id})`);
    res.json({ success: true, message: 'Application submitted successfully' });
});

// Update application status (Protected Route)
// Apply the authenticateToken middleware
app.put('/api/applications/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status. Must be "approved" or "rejected".' });
    }

    // Find the application by ID
    const applicationIndex = applications.findIndex(app => app.id === parseInt(id, 10));

    if (applicationIndex !== -1) {
        // Update the status
        applications[applicationIndex].status = status;
        console.log(`Application ID ${id} status updated to ${status}`);
        res.json({ success: true, message: `Application status updated to ${status}` });
    } else {
        res.status(404).json({ success: false, message: 'Application not found' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
