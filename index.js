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
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error("Error: MONGODB_URI is not defined in the environment variables.");
    process.exit(1);
}

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
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const dbName = process.env.MONGODB_DB_NAME || "snm_esports";
    db = client.db(dbName);

    newsCollection = db.collection("news");

    console.log(`Using database: ${dbName}`);
    console.log(`Connected to collections: news`);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
            res.status(500).send('Internal Server Error');
        }
    });
});

// --- API Routes ---

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Validate credentials
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

// --- News Management Routes ---

// Get all news articles (Public Route - for news.html)
app.get('/api/news', async (req, res) => {
    try {
        const newsItems = await newsCollection.find({}).sort({ publishedAt: -1 }).toArray();
        res.json({ success: true, news: newsItems });
    } catch (error) {
        console.error('Error fetching news from MongoDB:', error);
        res.status(500).json({ success: false, message: 'Failed to load news articles.' });
    }
});

// Create a new news article (Protected Route)
app.post('/api/news', authenticateToken, async (req, res) => {
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
        const insertedId = result.insertedId;
        console.log(`New news article created with ID: ${insertedId}`);
        res.status(201).json({ success: true, message: 'News article created successfully', newsItem: { _id: insertedId, ...newNewsItem } });
    } catch (error) {
        console.error('Error creating news article in MongoDB:', error);
        res.status(500).json({ success: false, message: 'Failed to create news article.' });
    }
});

// Delete a news article (Protected Route)
app.delete('/api/news/:id', authenticateToken, async (req, res) => {
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
connectToDatabase().then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n==========================================`);
        console.log(`  Server is running on http://0.0.0.0:${PORT}`);
        console.log(`==========================================\n`);
        console.log(`Expected Admin Credentials:`);
        console.log(`  Username: ${process.env.ADMIN_USERNAME || 'NOT SET'}`);
        console.log(`  Password: ${process.env.ADMIN_PASSWORD ? '[SET]' : 'NOT SET'}`);
        console.log(`  JWT Secret: ${process.env.JWT_SECRET ? '[SET]' : 'NOT SET'}`);
        console.log(`  MongoDB URI Set: ${process.env.MONGODB_URI ? 'YES' : 'NO'}`);
        console.log(`==========================================\n`);
    });

    server.on('error', (err) => {
        console.error('Server failed to start:', err);
        process.exit(1);
    });
}).catch(err => {
    console.error("Failed to start server due to database connection error:", err);
    process.exit(1);
});
