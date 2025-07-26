// index.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage for applications (in production, use a database)
let applications = [];

// --- Routes to serve HTML pages ---

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve other HTML pages
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
    
    // In a real application, this would check against a database
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Get all applications (protected)
app.get('/api/applications', (req, res) => {
    // Simple token verification (in production, use a more robust middleware)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        res.json({ success: true, applications });
    });
});

// Submit application
app.post('/api/applications', (req, res) => {
    const application = {
        id: Date.now(), // Simple ID for demo
        ...req.body,
        status: 'pending',
        submittedAt: new Date().toISOString()
    };
    
    applications.push(application);
    res.json({ success: true, message: 'Application submitted successfully' });
});

// Update application status (protected)
app.put('/api/applications/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    // Simple token verification
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }

        const applicationIndex = applications.findIndex(app => app.id === parseInt(id));
        
        if (applicationIndex !== -1) {
            applications[applicationIndex].status = status;
            res.json({ success: true, message: 'Application status updated' });
        } else {
            res.status(404).json({ success: false, message: 'Application not found' });
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
