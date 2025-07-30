// index.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
// --- Import MongoDB ---
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- MongoDB Connection Setup ---
const uri = process.env.MONGODB_URI; // Add your MongoDB connection string to Render Dashboard Env Vars
if (!uri) {
    console.error("Error: MONGODB_URI is not defined in the environment variables.");
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let db;
let newsCollection;

async function connectToDatabase() {
    if (!uri) return; // Skip if URI not set
    try {
        // Connect the client to the server
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // Select the database and collection
        db = client.db(process.env.MONGODB_DB_NAME || "snm_esports"); // Use DB name from env or default
        newsCollection = db.collection("news"); // Collection name

        // --- Optional: Create an index on publishedAt for sorting ---
        await newsCollection.createIndex({ publishedAt: -1 }); // -1 for descending order
        console.log(`Using database: ${db.databaseName}, collection: news`);
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- In-memory storage for applications (unchanged) ---
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("Token verification error:", err.message);
        res.status(403).json({ success: false, message: 'Invalid Token.' });
    }
};

// --- Serve HTML Pages ---
app.get(['/', '/about.html', '/merch.html', '/apply.html', '/news.html', '/admin.html'], (req, res) => {
    let filename = 'index.html';
    if (req.path !== '/') {
        filename = req.path.substring(1);
    }
    res.sendFile(path.join(__dirname, 'public', filename), (err) => {
        if (err) {
            console.error(`Error sending file ${filename}:`, err);
            res.status(404).send('File not found');
        }
    });
});

// --- API Routes ---

// Login endpoint (supports two admin users)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Define valid admin credential pairs from environment variables
    const validCredentials = [
        { user: process.env.ADMIN_USERNAME, pass: process.env.ADMIN_PASSWORD },
        { user: process.env.ADMIN2_USERNAME, pass: process.env.ADMIN2_PASSWORD }
    ];

    // Check if credentials match any valid pair
    const isValid = validCredentials.some(cred => {
        return cred.user && cred.pass && username === cred.user && password === cred.pass;
    });

    if (isValid) {
        const token = jwt.sign({ username: username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ success: true, token: token });
    } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// --- Application Management Routes ---
// GET all applications
app.get('/api/applications', (req, res) => {
    res.json({ success: true, applications });
});

// POST a new application
app.post('/api/applications', (req, res) => {
    const { ign, rank, region, experience, favoriteHero, whyJoin } = req.body;

    if (!ign || !rank || !region || !experience || !favoriteHero || !whyJoin) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const newApplication = {
        id: Date.now().toString(),
        ign,
        rank,
        region,
        experience,
        favoriteHero,
        whyJoin,
        submittedAt: new Date().toISOString()
    };

    applications.push(newApplication);
    console.log(`New application received: ${ign}`);
    res.status(201).json({ success: true, message: 'Application submitted successfully!' });
});

// PUT (update) an application
app.put('/api/applications/:id', (req, res) => {
    const { id } = req.params;
    const { ign, rank, region, experience, favoriteHero, whyJoin } = req.body;

    if (!ign || !rank || !region || !experience || !favoriteHero || !whyJoin) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const index = applications.findIndex(app => app.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    applications[index] = { ...applications[index], ign, rank, region, experience, favoriteHero, whyJoin };
    console.log(`Application ID ${id} updated`);
    res.json({ success: true, message: 'Application updated successfully!' });
});

// DELETE an application
app.delete('/api/applications/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const index = applications.findIndex(app => app.id === id);

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    applications.splice(index, 1);
    console.log(`Application ID ${id} deleted`);
    res.json({ success: true, message: 'Application deleted successfully!' });
});

// --- News Management Routes (Modified for MongoDB) ---

// Get all news articles (Public Route)
app.get('/api/news', async (req, res) => {
    if (!newsCollection) {
        console.error("Database not connected for /api/news GET");
        return res.status(500).json({ success: false, message: 'Database connection error.' });
    }
    try {
        const newsItems = await newsCollection.find({}).sort({ publishedAt: -1 }).toArray();
        const serializedNews = newsItems.map(item => ({
            ...item,
            id: item._id.toString(),
            _id: item._id.toString()
        }));
        res.json({ success: true, news: serializedNews });
    } catch (error) {
        console.error('Error fetching news from MongoDB:', error);
        res.status(500).json({ success: false, message: 'Failed to load news articles.' });
    }
});

// Create a new news article (Protected Route)
app.post('/api/news', authenticateToken, async (req, res) => {
    if (!newsCollection) {
        console.error("Database not connected for /api/news POST");
        return res.status(500).json({ success: false, message: 'Database connection error.' });
    }

    const { title, description, bannerUrl } = req.body;

    if (!title || !description) {
        return res.status(400).json({ success: false, message: 'Title and Description are required.' });
    }

    const newNewsItem = {
        title,
        description,
        bannerUrl: bannerUrl || '',
        publishedAt: new Date()
    };

    try {
        const result = await newsCollection.insertOne(newNewsItem);
        const insertedItem = { _id: result.insertedId.toString(), ...newNewsItem, id: result.insertedId.toString() };
        console.log(`New news article created with ID: ${result.insertedId}`);
        res.status(201).json({ success: true, message: 'News article created successfully', newsItem: insertedItem });
    } catch (error) {
        console.error('Error creating news article in MongoDB:', error);
        res.status(500).json({ success: false, message: 'Failed to create news article.' });
    }
});

// Delete a news article (Protected Route)
app.delete('/api/news/:id', authenticateToken, async (req, res) => {
    if (!newsCollection) {
        console.error("Database not connected for /api/news DELETE");
        return res.status(500).json({ success: false, message: 'Database connection error.' });
    }

    const { id } = req.params;
    let objectId;
    try {
        objectId = new ObjectId(id);
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
    console.log('\nShutting down gracefully (SIGINT)...');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed.');
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully (SIGTERM)...');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed.');
    }
    process.exit(0);
});

// --- Start Server ---
connectToDatabase().then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`
==========================================`);
        console.log(`  Server is running on http://0.0.0.0:${PORT}`);
        console.log(`==========================================`);
        console.log(`Expected Admin Credentials:`);
        console.log(`  Username: ${process.env.ADMIN_USERNAME || 'NOT SET (check Render Env Vars)'}`);
        console.log(`  Password: ${process.env.ADMIN_PASSWORD ? '[SET]' : 'NOT SET (check Render Env Vars)'}`);
        console.log(`  Admin2 Username: ${process.env.ADMIN2_USERNAME || 'NOT SET (check Render Env Vars)'}`);
        console.log(`  Admin2 Password: ${process.env.ADMIN2_PASSWORD ? '[SET]' : 'NOT SET (check Render Env Vars)'}`);
        console.log(`  JWT Secret: ${process.env.JWT_SECRET ? '[SET]' : 'NOT SET (check Render Env Vars)'}`);
        console.log(`  MongoDB URI Set: ${process.env.MONGODB_URI ? 'YES' : 'NO (check Render Env Vars)'}`);
        console.log(`==========================================`);
    });

    server.on('error', (err) => {
        console.error('Server failed to start:', err);
        process.exit(1);
    });
}).catch(err => {
    console.error("Failed to start server due to database connection setup error:", err);
    process.exit(1);
});
