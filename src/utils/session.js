import crypto from 'crypto';

// ============================================================
// In-memory session store.
// Sessions live only as long as the bot process is running —
// if the bot restarts, everyone gets logged out. That's fine
// for this project's size; if you ever need sessions to survive
// restarts, they'd need to move into the database instead.
// ============================================================

const SESSION_COOKIE_NAME = 'tb_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const sessions = new Map(); // sessionId -> { userId, username, avatar, createdAt, expiresAt }

function getSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        throw new Error('SESSION_SECRET environment variable is not set. Add it to your .env / Render env vars.');
    }
    return secret;
}

function sign(value) {
    const hmac = crypto.createHmac('sha256', getSecret());
    hmac.update(value);
    return hmac.digest('hex');
}

function createSignedCookieValue(sessionId) {
    return `${sessionId}.${sign(sessionId)}`;
}

function verifySignedCookieValue(cookieValue) {
    if (!cookieValue || typeof cookieValue !== 'string') return null;

    const parts = cookieValue.split('.');
    if (parts.length !== 2) return null;

    const [sessionId, signature] = parts;
    const expectedSignature = sign(sessionId);

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    return sessionId;
}

function parseCookies(req) {
    const header = req.headers.cookie;
    const cookies = {};
    if (!header) return cookies;

    header.split(';').forEach((pair) => {
        const idx = pair.indexOf('=');
        if (idx === -1) return;
        const key = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        cookies[key] = decodeURIComponent(value);
    });

    return cookies;
}

/**
 * Create a new session for a logged-in Discord user.
 * Returns the raw session ID (not the signed cookie value).
 */
export function createSession(userData) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_TTL_MS;
    sessions.set(sessionId, { ...userData, createdAt: Date.now(), expiresAt });
    return sessionId;
}

export function destroySession(sessionId) {
    if (sessionId) sessions.delete(sessionId);
}

export function getSession(sessionId) {
    if (!sessionId) return null;
    const session = sessions.get(sessionId);
    if (!session) return null;

    if (session.expiresAt < Date.now()) {
        sessions.delete(sessionId);
        return null;
    }

    return session;
}

/** Attach a signed, HttpOnly session cookie to the response. */
export function attachSessionCookie(res, sessionId) {
    const cookieValue = createSignedCookieValue(sessionId);
    const isProduction = process.env.NODE_ENV === 'production';

    const cookieParts = [
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}`,
        'Path=/',
        'HttpOnly',
        `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
        'SameSite=Lax'
    ];

    if (isProduction) {
        cookieParts.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieParts.join('; '));
}

export function clearSessionCookie(res) {
    const cookieParts = [
        `${SESSION_COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'Max-Age=0',
        'SameSite=Lax'
    ];

    res.setHeader('Set-Cookie', cookieParts.join('; '));
}

/** Reads and verifies the session cookie from an incoming request. */
export function getSessionFromRequest(req) {
    const cookies = parseCookies(req);
    const cookieValue = cookies[SESSION_COOKIE_NAME];
    if (!cookieValue) return null;

    const sessionId = verifySignedCookieValue(cookieValue);
    if (!sessionId) return null;

    return { sessionId, session: getSession(sessionId) };
}

/**
 * Express middleware — blocks the request with 401 if the user
 * isn't logged in, otherwise attaches req.session / req.sessionId.
 */
export function requireAuth(req, res, next) {
    const result = getSessionFromRequest(req);

    if (!result || !result.session) {
        return res.status(401).json({ error: 'Not logged in.' });
    }

    req.session = result.session;
    req.sessionId = result.sessionId;
    next();
}
