const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage for applications
let applications = [];

// Serve static files
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

// API Routes

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Get all applications
app.get('/api/applications', (req, res) => {
    res.json({ success: true, applications });
});

// Submit application
app.post('/api/applications', (req, res) => {
    const application = {
        id: Date.now(),
        ...req.body,
        status: 'pending',
        submittedAt: new Date().toISOString()
    };
    
    applications.push(application);
    res.json({ success: true, message: 'Application submitted successfully' });
});

// Update application status
app.put('/api/applications/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const applicationIndex = applications.findIndex(app => app.id === parseInt(id));
    
    if (applicationIndex !== -1) {
        applications[applicationIndex].status = status;
        res.json({ success: true, message: 'Application status updated' });
    } else {
        res.status(404).json({ success: false, message: 'Application not found' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
