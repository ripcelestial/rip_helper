// src/server.js
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const db = require('./services/database'); // Make sure this path points to your DB service

const app = express();
const PORT = process.env.PORT || 3000;

// Security configuration: List of authorized Discord IDs allowed to login
const AUTHORIZED_USERS = [
    "YOUR_DISCORD_USER_ID",         // Replace with your Discord ID
    "YOUR_FRIENDS_DISCORD_USER_ID"  // Replace with your YouTuber friend's Discord ID
];

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'private-helper-fallback-secret-9911',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if running under a custom SSL domain
        maxAge: 1000 * 60 * 60 * 24 // Cookie lasts for 24 hours
    }
}));

app.use(express.json());
// Serve static assets from public folder
app.use(express.static(path.join(__dirname, '../public')));

// ─── SECURE DISCORD OAUTH2 FLOW ──────────────────────────────────────────

// Step 1: Send user to Discord Authorization portal
app.get('/api/auth/login', (req, res) => {
    const authorizeUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(authorizeUrl);
});

// Step 2: The callback landing spot where Discord redirects the user with a temporary code
app.get('/api/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('Authorization code was not provided by Discord.');

    try {
        // Exchange code for an Access Token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // Fetch User profile from Discord
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const discordUser = userResponse.data;

        // PRIVATE CHECK: Block anyone whose Discord ID is not in our authorized array
        if (!AUTHORIZED_USERS.includes(discordUser.id)) {
            return res.status(403).send('<h1>Access Denied</h1><p>This is a private administrative dashboard. Your Discord account is unauthorized.</p>');
        }

        // Save session credentials
        req.session.user = discordUser;
        res.redirect('/dashboard.html');

    } catch (error) {
        console.error('OAuth2 Error:', error.response ? error.response.data : error.message);
        res.status(500).send('Authentication processing failed.');
    }
});

// Log out of the web session
app.get('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/index.html');
});

// ─── PROTECTED DATA INTERFACES ───────────────────────────────────────────

// Retrieve live PostgreSQL stats for the logged-in authorized admin/staff member
app.get('/api/user/stats', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized session' });
    }

    const discordId = req.session.user.id;

    try {
        // Query your PostgreSQL database (update schema names matching your actual DB setup)
        const result = await db.query('SELECT xp, level, balance FROM users WHERE id = $1', [discordId]);
        
        // Use database values if they exist, fallback to defaults if they don't
        const stats = result.rows[0] || { xp: 0, level: 1, balance: 0 };

        res.json({
            id: discordId,
            username: req.session.user.username,
            avatar: req.session.user.avatar,
            xp: stats.xp,
            level: stats.level,
            balance: stats.balance
        });

    } catch (err) {
        console.error('Database connection failed:', err);
        res.status(500).json({ error: 'Failed to access server database records.' });
    }
});

// Startup hook for the web framework
function startWebServer(client) {
    app.listen(PORT, () => {
        console.log(`🌐 [Web Dashboard] Listening securely on port ${PORT}`);
    });
}

module.exports = { startWebServer };