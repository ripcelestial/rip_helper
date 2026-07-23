import express from 'express';
import axios from 'axios';
import {
    createSession,
    attachSessionCookie,
    clearSessionCookie,
    getSessionFromRequest,
    destroySession
} from '../utils/session.js';
import logger from '../utils/logger.js';

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';

function getRedirectUri() {
    return process.env.REDIRECT_URI || 'http://localhost:3000/api/auth/callback';
}

// Step 1: send the user to Discord to log in and approve access.
router.get('/login', (req, res) => {
    const clientId = process.env.CLIENT_ID;

    if (!clientId) {
        return res.status(500).send('Bot is missing CLIENT_ID in its environment variables.');
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: getRedirectUri(),
        response_type: 'code',
        scope: 'identify guilds'
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// Step 2: Discord redirects back here with a one-time code.
// We trade that code for an access token, then fetch who the user is.
router.get('/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`Login was cancelled or failed: ${error}`);
    }

    if (!code) {
        return res.status(400).send('Missing authorization code from Discord.');
    }

    try {
        const tokenResponse = await axios.post(
            `${DISCORD_API}/oauth2/token`,
            new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: getRedirectUri()
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token } = tokenResponse.data;

        const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const discordUser = userResponse.data;

        const sessionId = createSession({
            userId: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar
        });

        attachSessionCookie(res, sessionId);
        res.redirect('/manage.html');
    } catch (err) {
        const message = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        logger.error(`OAuth callback failed: ${message}`);
        res.status(500).send('Login failed. Please close this tab and try /web-config again.');
    }
});

router.get('/logout', (req, res) => {
    const result = getSessionFromRequest(req);
    if (result?.sessionId) {
        destroySession(result.sessionId);
    }
    clearSessionCookie(res);
    res.redirect('/manage.html');
});

// Used by the dashboard pages to check "am I logged in, and as who?"
router.get('/me', (req, res) => {
    const result = getSessionFromRequest(req);

    if (!result || !result.session) {
        return res.status(401).json({ loggedIn: false });
    }

    res.json({
        loggedIn: true,
        userId: result.session.userId,
        username: result.session.username,
        avatar: result.session.avatar
    });
});

export default router;
