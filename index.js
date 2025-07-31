// index.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// --- MongoDB Connection Setup ---
const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("Error: MONGODB_URI is not defined in the environment variables.");
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
let popupCollection;

async function connectToDatabase() {
    if (!uri) return;
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        db = client.db(process.env.MONGODB_DB_NAME || "snm_esports");
        newsCollection = db.collection("news");
        popupCollection = db.collection("popup");

        await newsCollection.createIndex({ publishedAt: -1 });
        await popupCollection.createIndex({ active: 1 });

        console.log(`Using database: ${db.databaseName}, collections: news, popup`);
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- JWT Authentication ---
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

// --- Login Route ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const validCredentials = [
        { user: process.env.ADMIN_USERNAME, pass: process.env.ADMIN_PASSWORD },
        { user: process.env.ADMIN2_USERNAME, pass: process.env.ADMIN2_PASSWORD }
    ];

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

// --- In-memory Applications ---
let applications = [];

app.get('/api/applications', (req, res) => {
    res.json({ success: true, applications });
});

app.post('/api/applications', (req, res) => {
    const { ign, rank, region, experience, favoriteHero, whyJoin } = req.body;
    if (!ign || !rank || !region || !experience || !favoriteHero || !whyJoin) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    const newApplication = {
        id: Date.now().toString(),
        ign, rank, region, experience, favoriteHero, whyJoin,
        submittedAt: new Date().toISOString()
    };
    applications.push(newApplication);
    console.log(`New application received: ${ign}`);
    res.status(201).json({ success: true, message: 'Application submitted successfully!' });
});

app.put('/api/applications/:id', (req, res) => {
    const { id } = req.params;
    const { ign, rank, region, experience, favoriteHero, whyJoin } = req.body;
    if (!ign || !rank || !region || !experience || !favoriteHero || !whyJoin) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    const index = applications.findIndex(app => app.id === id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Application not found.' });
    applications[index] = { ...applications[index], ign, rank, region, experience, favoriteHero, whyJoin };
    console.log(`Application ID ${id} updated`);
    res.json({ success: true, message: 'Application updated successfully!' });
});

app.delete('/api/applications/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const index = applications.findIndex(app => app.id === id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Application not found.' });
    applications.splice(index, 1);
    console.log(`Application ID ${id} deleted`);
    res.json({ success: true, message: 'Application deleted successfully!' });
});

// --- News Management ---
app.get('/api/news', async (req, res) => {
    if (!newsCollection) return res.status(500).json({ success: false, message: 'Database connection error.' });
    try {
        const newsItems = await newsCollection.find({}).sort({ publishedAt: -1 }).toArray();
        const serializedNews = newsItems.map(item => ({ ...item, id: item._id.toString() }));
        res.json({ success: true, news: serializedNews });
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ success: false, message: 'Failed to load news articles.' });
    }
});

app.post('/api/news', authenticateToken, async (req, res) => {
    if (!newsCollection) return res.status(500).json({ success: false, message: 'Database connection error.' });
    const { title, description, bannerUrl } = req.body;
    if (!title || !description) {
        return res.status(400).json({ success: false, message: 'Title and Description are required.' });
    }
    const newNewsItem = { title, description, bannerUrl: bannerUrl || '', publishedAt: new Date() };
    try {
        const result = await newsCollection.insertOne(newNewsItem);
        const insertedItem = { _id: result.insertedId.toString(), ...newNewsItem, id: result.insertedId.toString() };
        console.log(`News created with ID: ${result.insertedId}`);
        res.status(201).json({ success: true, message: 'News article created', newsItem: insertedItem });
    } catch (error) {
        console.error('Error creating news:', error);
        res.status(500).json({ success: false, message: 'Failed to create news article.' });
    }
});

app.delete('/api/news/:id', authenticateToken, async (req, res) => {
    if (!newsCollection) return res.status(500).json({ success: false, message: 'Database connection error.' });
    const { id } = req.params;
    let objectId;
    try { objectId = new ObjectId(id); } catch (err) { return res.status(400).json({ success: false, message: 'Invalid ID.' }); }
    try {
        const result = await newsCollection.deleteOne({ _id: objectId });
        if (result.deletedCount === 1) {
            console.log(`News ID ${id} deleted`);
            res.json({ success: true, message: 'News article deleted' });
        } else {
            res.status(404).json({ success: false, message: 'News article not found' });
        }
    } catch (error) {
        console.error('Error deleting news:', error);
        res.status(500).json({ success: false, message: 'Failed to delete news article.' });
    }
});

// --- Popup Management ---
app.get('/api/popup', async (req, res) => {
    if (!popupCollection) return res.status(500).json({ success: false, message: 'Database connection error.' });
    try {
        const activePopup = await popupCollection.findOne({ active: true });
        if (activePopup) {
            res.json({
                success: true,
                popup: {
                    id: activePopup._id.toString(),
                    title: activePopup.title,
                    message: activePopup.message,
                    link: activePopup.link || null,
                    linkText: activePopup.linkText || 'More Info'
                }
            });
        } else {
            res.json({ success: true, popup: null });
        }
    } catch (error) {
        console.error('Error fetching popup:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.post('/api/popup', authenticateToken, async (req, res) => {
    if (!popupCollection) return res.status(500).json({ success: false, message: 'Database connection error.' });
    const { title, message, link, linkText } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message are required.' });

    try {
        await popupCollection.updateMany({ active: true }, { $set: { active: false } });
        const newPopup = {
            title,
            message,
            link: link || '',
            linkText: linkText || 'More Info',
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await popupCollection.insertOne(newPopup);
        console.log(`Popup created with ID: ${result.insertedId}`);
        res.status(201).json({
            success: true,
            message: 'Popup published successfully',
            popup: { id: result.insertedId.toString(), ...newPopup }
        });
    } catch (error) {
        console.error('Error creating popup:', error);
        res.status(500).json({ success: false, message: 'Failed to create popup.' });
    }
});

app.delete('/api/popup/:id', authenticateToken, async (req, res) => {
    if (!popupCollection) return res.status(500).json({ success: false, message: 'Database connection error.' });
    const { id } = req.params;
    let objectId;
    try { objectId = new ObjectId(id); } catch (err) { return res.status(400).json({ success: false, message: 'Invalid ID.' }); }
    try {
        const result = await popupCollection.updateOne({ _id: objectId }, { $set: { active: false } });
        if (result.modifiedCount === 1) {
            console.log(`Popup ID ${id} deactivated`);
            res.json({ success: true, message: 'Popup removed successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Popup not found' });
        }
    } catch (error) {
        console.error('Error removing popup:', error);
        res.status(500).json({ success: false, message: 'Failed to remove popup.' });
    }
});

// --- Graceful Shutdown ---
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully (SIGINT)...');
    if (client) await client.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully (SIGTERM)...');
    if (client) await client.close();
    process.exit(0);
});

// --- Start Server ---
connectToDatabase().then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`
==========================================`);
        console.log(`  Server is running on http://0.0.0.0:${PORT}`);
        console.log(`==========================================`);
    });
    server.on('error', (err) => {
        console.error('Server failed to start:', err);
        process.exit(1);
    });
}).catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
