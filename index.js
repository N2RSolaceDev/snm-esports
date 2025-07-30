// index.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
// --- Import MongoDB ---
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Use PORT from environment or default to 3000

// --- MongoDB Connection Setup ---
const uri = process.env.MONGODB_URI; // Crucial: Set this in Render Dashboard

if (!uri) {
    console.error("Error: MONGODB_URI is not defined in the environment variables.");
    process.exit(1); // Exit if no URI is provided
}

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
let newsCollection;
let applicationsCollection; // Optional: Store applications in MongoDB too

async function connectToDatabase() {
  try {
    // Connect the client to the server
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your MongoDB deployment. Successfully connected!");

    // Select the database (use name from .env or default)
    const dbName = process.env.MONGODB_DB_NAME || "snm_esports";
    db = client.db(dbName);

    // Select the collections
    newsCollection = db.collection("news");
    applicationsCollection = db.collection("applications"); // If you want to persist apps

    // --- Optional: Create indexes for better performance ---
    // Index on news publishedAt for sorting
    await newsCollection.createIndex({ publishedAt: -1 });
    // Index on applications submittedAt for sorting (if using MongoDB for apps)
    // await applicationsCollection.createIndex({ submittedAt: -1 });
    // Index on applications status for filtering (if using MongoDB for apps)
    // await applicationsCollection.createIndex({ status: 1 });

    console.log(`Using database: ${dbName}`);
    console.log(`Connected to collections: news, applications`);

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1); // Exit if connection fails
  }
}

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- In-memory storage for applications (You can migrate this to MongoDB too if needed) ---
// For now, keeping applications in-memory as per original, but recommend moving to DB.
let applications = [];

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Crucial: Set this in Render Dashboard
        req.user = decoded;
        next();
    } catch (err) {
        console.error("Token verification error:", err.message);
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
            // Don't send a 500 here, let Express handle it or send a generic 404
            if (err.code === 'ENOENT') {
                 res.status(404).send('File not found');
            } else {
                 res.status(500).send('Internal Server Error');
            }
        }
    });
});

// --- API Routes ---

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Check if environment variables are set (good practice for debugging)
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
         console.error("Critical: ADMIN credentials or JWT_SECRET not set in environment variables!");
         // Still proceed with logic, but log the error
    }

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Compare against environment variables
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ username: username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ success: true, token: token });
    } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// --- Application Management Routes (Using in-memory for now) ---

// Get all applications (Protected Route)
app.get('/api/applications', authenticateToken, (req, res) => {
    res.json({ success: true, applications: applications });
});

// Submit application (Public Route)
app.post('/api/applications', (req, res) => {
    const newApplication = {
        id: Date.now(), // Simple ID generation for in-memory
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

// --- News Management Routes (Modified for MongoDB) ---

// Get all news articles (Public Route - for news.html)
// Fetches from MongoDB instead of in-memory array
app.get('/api/news', async (req, res) => {
    try {
        // Fetch all news articles from the collection, sorted by publishedAt descending
        const newsItems = await newsCollection.find({}).sort({ publishedAt: -1 }).toArray();

        res.json({ success: true, news: newsItems });
    } catch (error) {
        console.error('Error fetching news from MongoDB:', error);
        res.status(500).json({ success: false, message: 'Failed to load news articles.' });
    }
});

// Create a new news article (Protected Route)
// Stores in MongoDB instead of in-memory array
app.post('/api/news', authenticateToken, async (req, res) => {
    const { title, description, bannerUrl } = req.body;

    // Basic validation
    if (!title || !description) {
        return res.status(400).json({ success: false, message: 'Title and Description are required.' });
    }

    const newNewsItem = {
        title,
        description,
        bannerUrl: bannerUrl || '',
        publishedAt: new Date() // Store as Date object
    };

    try {
        const result = await newsCollection.insertOne(newNewsItem);
        // MongoDB driver 6.x returns the insertedId directly
        const insertedId = result.insertedId;
        console.log(`New news article created with ID: ${insertedId}`);
        // Return the full item including the _id generated by MongoDB
        res.status(201).json({ success: true, message: 'News article created successfully', newsItem: { _id: insertedId, ...newNewsItem } });
    } catch (error) {
        console.error('Error creating news article in MongoDB:', error);
        res.status(500).json({ success: false, message: 'Failed to create news article.' });
    }
});

// Delete a news article (Protected Route)
// Deletes from MongoDB instead of in-memory array
app.delete('/api/news/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Handle potential invalid ObjectId format
    let objectId;
    try {
        objectId = new ObjectId(id); // Try to convert string ID to ObjectId
    } catch (err) {
        console.error("Invalid ObjectId format for deletion:", id);
        return res.status(400).json({ success: false, message: 'Invalid news article ID format.' });
    }

    try {
        const result = await newsCollection.deleteOne({ _id: objectId });

        if (result.deletedCount === 1) {
            console.log(`News article ID ${id} deleted`);
            res.json({ success: true, message: 'News article deleted successfully' });
        } else {
            // This case handles if the ID format was valid but no document matched
            console.log(`News article ID ${id} not found for deletion`);
            res.status(404).json({ success: false, message: 'News article not found' });
        }
    } catch (error) {
        console.error('Error deleting news article from MongoDB:', error);
        res.status(500).json({ success: false, message: 'Failed to delete news article.' });
    }
});

// --- Graceful Shutdown ---
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await client.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully (SIGTERM)...');
  await client.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
});

// --- Start Server ---
// Connect to MongoDB before starting the server
connectToDatabase().then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => { // Bind to 0.0.0.0 for Render
        console.log(`\n==========================================`);
        console.log(`  Server is running on http://0.0.0.0:${PORT}`); // Log 0.0.0.0 for clarity
        console.log(`==========================================\n`);
        // Log expected credentials (masked password for security)
        console.log(`Expected Admin Credentials:`);
        console.log(`  Username: ${process.env.ADMIN_USERNAME || 'NOT SET (check Render Env Vars)'}`);
        console.log(`  Password: ${process.env.ADMIN_PASSWORD ? '[SET]' : 'NOT SET (check Render Env Vars)'}`);
        console.log(`  JWT Secret: ${process.env.JWT_SECRET ? '[SET]' : 'NOT SET (check Render Env Vars)'}`);
        console.log(`  MongoDB URI Set: ${process.env.MONGODB_URI ? 'YES' : 'NO (check Render Env Vars)'}`);
        console.log(`==========================================\n`);
    });

    // Handle server errors
    server.on('error', (err) => {
        console.error('Server failed to start:', err);
        process.exit(1);
    });
}).catch(err => {
    console.error("Failed to start server due to database connection error:", err);
    process.exit(1);
});
