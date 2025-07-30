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

// --- In-memory storage for applications and news ---
let applications = [];
let news = []; // Array to store news articles

// --- Helper Functions ---

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Access Denied. No Token Provided.' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access Denied. Token Missing.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("Token verification error:", err.message); // Log for debugging
        res.status(403).json({ success: false, message: 'Invalid Token.' });
    }
};

// --- Serve HTML Pages ---
// Simplified route to serve any HTML file from /public
app.get(['/', '/about.html', '/merch.html', '/apply.html', '/news.html', '/admin.html'], (req, res) => {
    let filename = 'index.html'; // Default
    if (req.path !== '/') {
        filename = req.path.substring(1); // Remove leading slash
    }
    res.sendFile(path.join(__dirname, 'public', filename), (err) => {
        if (err) {
            console.error(`Error sending file ${filename}:`, err);
            res.status(404).send('File not found');
        }
    });
});

// --- API Routes ---

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ username: username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ success: true, token: token });
    } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// --- Application Management Routes ---

// Get all applications (Protected Route)
app.get('/api/applications', authenticateToken, (req, res) => {
    res.json({ success: true, applications: applications });
});

// Submit application (Public Route)
app.post('/api/applications', (req, res) => {
    const newApplication = {
        id: Date.now(), // Simple ID generation
        ...req.body,
        status: 'pending',
        submittedAt: new Date().toISOString()
    };

    applications.push(newApplication);
    console.log(`New application received (ID: ${newApplication.id})`);
    res.json({ success: true, message: 'Application submitted successfully' });
});

// Update application status (Protected Route)
app.put('/api/applications/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status. Must be "approved" or "rejected".' });
    }

    const applicationIndex = applications.findIndex(app => app.id === parseInt(id, 10));

    if (applicationIndex !== -1) {
        applications[applicationIndex].status = status;
        console.log(`Application ID ${id} status updated to ${status}`);
        res.json({ success: true, message: `Application status updated to ${status}` });
    } else {
        res.status(404).json({ success: false, message: 'Application not found' });
    }
});

// Delete an application (Protected Route)
app.delete('/api/applications/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const applicationIndex = applications.findIndex(app => app.id === parseInt(id, 10));

    if (applicationIndex !== -1) {
        const deletedApp = applications.splice(applicationIndex, 1);
        console.log(`Application ID ${id} deleted`);
        res.json({ success: true, message: 'Application deleted successfully', deletedApplication: deletedApp[0] });
    } else {
        res.status(404).json({ success: false, message: 'Application not found' });
    }
});

// --- News Management Routes (Protected) ---

// Get all news articles (Public Route - for news.html)
app.get('/api/news', (req, res) => {
    // Send the news array wrapped in an object for consistency
    // Sort by publishedAt descending (newest first) before sending
    const sortedNews = [...news].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    res.json({ success: true, news: sortedNews });
});

// Create a new news article (Protected Route)
app.post('/api/news', authenticateToken, (req, res) => {
    const { title, description, bannerUrl } = req.body;

    // Basic validation
    if (!title || !description) {
        return res.status(400).json({ success: false, message: 'Title and Description are required.' });
    }

    const newNewsItem = {
        id: Date.now(), // Simple ID generation
        title,
        description,
        bannerUrl: bannerUrl || '', // Allow empty banner URL
        publishedAt: new Date().toISOString()
    };

    news.push(newNewsItem);
    console.log(`New news article created (ID: ${newNewsItem.id})`);
    res.status(201).json({ success: true, message: 'News article created successfully', newsItem: newNewsItem });
});

// Delete a news article (Protected Route)
app.delete('/api/news/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const newsIndex = news.findIndex(item => item.id === parseInt(id, 10));

    if (newsIndex !== -1) {
        const deletedNews = news.splice(newsIndex, 1);
        console.log(`News article ID ${id} deleted`);
        res.json({ success: true, message: 'News article deleted successfully', deletedNewsItem: deletedNews[0] });
    } else {
        res.status(404).json({ success: false, message: 'News article not found' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`\n==========================================`);
    console.log(`  Server is running on http://localhost:${PORT}`);
    console.log(`==========================================\n`);
    // It's helpful to log the expected credentials on startup
    console.log(`Expected Admin Credentials:`);
    console.log(`  Username: ${process.env.ADMIN_USERNAME || 'NOT SET (check .env)'}`);
    console.log(`  Password: ${process.env.ADMIN_PASSWORD ? '[SET]' : 'NOT SET (check .env)'}`);
    console.log(`  JWT Secret: ${process.env.JWT_SECRET ? '[SET]' : 'NOT SET (check .env)'}`);
    console.log(`==========================================\n`);
});
