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
    // Consider exiting on Render if critical setup is missing
    // process.exit(1);
    // Or just log for now and let it fail later if DB is accessed
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
    // Depending on your app's resilience, you might want to exit here on Render
    // process.exit(1);
  }
}

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- In-memory storage for applications (unchanged) ---
let applications = [];
// let news = []; // Remove or comment out the in-memory news array

// --- Helper Functions ---

// Middleware to verify JWT token (unchanged)
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

// --- Serve HTML Pages (unchanged) ---
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

// Login endpoint (unchanged)
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

// --- Application Management Routes (unchanged) ---
// ... (GET, POST, PUT, DELETE /api/applications remain the same) ...

// --- News Management Routes (Modified for MongoDB) ---

// Get all news articles (Public Route - for news.html)
// Fetches from MongoDB instead of in-memory array
app.get('/api/news', async (req, res) => {
    // Ensure DB is connected (optional check)
    if (!newsCollection) {
        console.error("Database not connected for /api/news GET");
        return res.status(500).json({ success: false, message: 'Database connection error.' });
    }

    try {
        // Fetch all news articles from the collection, sorted by publishedAt descending
        const newsItems = await newsCollection.find({}).sort({ publishedAt: -1 }).toArray();
        // Convert ObjectId to string for JSON serialization if needed by frontend
        const serializedNews = newsItems.map(item => ({
            ...item,
            id: item._id.toString(), // Add 'id' string property for frontend compatibility if needed
            _id: item._id.toString()  // Ensure _id is also a string
        }));

        res.json({ success: true, news: serializedNews });
    } catch (error) {
        console.error('Error fetching news from MongoDB:', error);
        res.status(500).json({ success: false, message: 'Failed to load news articles.' });
    }
});

// Create a new news article (Protected Route)
// Stores in MongoDB instead of in-memory array
app.post('/api/news', authenticateToken, async (req, res) => {
     // Ensure DB is connected
    if (!newsCollection) {
        console.error("Database not connected for /api/news POST");
        return res.status(500).json({ success: false, message: 'Database connection error.' });
    }

    const { title, description, bannerUrl } = req.body;

    // Basic validation
    if (!title || !description) {
        return res.status(400).json({ success: false, message: 'Title and Description are required.' });
    }

    const newNewsItem = {
        // Let MongoDB generate _id, or generate your own if preferred
        title,
        description,
        bannerUrl: bannerUrl || '',
        publishedAt: new Date() // Store as Date object
    };

    try {
        const result = await newsCollection.insertOne(newNewsItem);
        // The inserted document (with _id) is available
        const insertedItem = { _id: result.insertedId.toString(), ...newNewsItem, id: result.insertedId.toString() }; // Add id string
        console.log(`New news article created with ID: ${result.insertedId}`);
        res.status(201).json({ success: true, message: 'News article created successfully', newsItem: insertedItem });
    } catch (error) {
        console.error('Error creating news article in MongoDB:', error);
        res.status(500).json({ success: false, message: 'Failed to create news article.' });
    }
});

// Delete a news article (Protected Route)
// Deletes from MongoDB instead of in-memory array
app.delete('/api/news/:id', authenticateToken, async (req, res) => {
    // Ensure DB is connected
    if (!newsCollection) {
        console.error("Database not connected for /api/news DELETE");
        return res.status(500).json({ success: false, message: 'Database connection error.' });
    }

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
// Connect to MongoDB before starting the server
connectToDatabase().then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => { // Listen on 0.0.0.0 for Render
        console.log(`\n==========================================`);
        console.log(`  Server is running on http://0.0.0.0:${PORT}`); // Log 0.0.0.0 for clarity on Render
        console.log(`==========================================\n`);
        console.log(`Expected Admin Credentials:`);
        console.log(`  Username: ${process.env.ADMIN_USERNAME || 'NOT SET (check Render Env Vars)'}`);
        console.log(`  Password: ${process.env.ADMIN_PASSWORD ? '[SET]' : 'NOT SET (check Render Env Vars)'}`);
        console.log(`  JWT Secret: ${process.env.JWT_SECRET ? '[SET]' : 'NOT SET (check Render Env Vars)'}`);
        console.log(`  MongoDB URI Set: ${process.env.MONGODB_URI ? 'YES' : 'NO (check Render Env Vars)'}`);
        console.log(`==========================================\n`);
    });

    // Handle server startup errors
    server.on('error', (err) => {
        console.error('Server failed to start:', err);
        process.exit(1);
    });

}).catch(err => {
    console.error("Failed to start server due to database connection setup error:", err);
    // If DB connection is critical, exit. Otherwise, you might choose to start anyway.
    process.exit(1);
});
