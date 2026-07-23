import express from 'express';
import { PermissionsBitField } from 'discord.js';
import authRouter from './auth.js';
import { requireAuth } from '../utils/session.js';
import { getGuildConfig, updateGuildConfig } from '../services/guildConfig.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Mounted here so the OAuth redirect URI ends up as /api/auth/callback
router.use('/auth', authRouter);

/** Grabs a member from cache, or fetches them from Discord if not cached. */
async function fetchMemberSafe(guild, userId) {
    let member = guild.members.cache.get(userId);
    if (member) return member;

    try {
        member = await guild.members.fetch(userId);
        return member;
    } catch {
        return null;
    }
}

function memberCanManage(guild, member, userId) {
    if (!member) return false;
    return member.permissions.has(PermissionsBitField.Flags.ManageGuild) || guild.ownerId === userId;
}

/**
 * Middleware: makes sure the logged-in user is actually in this server
 * AND has permission to change its settings, before any config route runs.
 */
async function requireGuildAccess(req, res, next) {
    const bot = req.bot;
    const { guildId } = req.params;
    const guild = bot.guilds.cache.get(guildId);

    if (!guild) {
        return res.status(404).json({ error: 'That server was not found, or the bot is not in it.' });
    }

    const member = await fetchMemberSafe(guild, req.session.userId);

    if (!memberCanManage(guild, member, req.session.userId)) {
        return res.status(403).json({ error: "You don't have permission to manage that server." });
    }

    req.guild = guild;
    next();
}

// List every server this user can manage (bot is in it + they have Manage Server / are the owner)
router.get('/guilds', requireAuth, async (req, res) => {
    try {
        const bot = req.bot;
        const userId = req.session.userId;
        const manageable = [];

        for (const guild of bot.guilds.cache.values()) {
            const member = await fetchMemberSafe(guild, userId);
            if (memberCanManage(guild, member, userId)) {
                manageable.push({
                    id: guild.id,
                    name: guild.name,
                    icon: guild.iconURL({ size: 64 }) || null
                });
            }
        }

        res.json({ guilds: manageable });
    } catch (error) {
        logger.error(`Failed to list manageable guilds: ${error.message}`);
        res.status(500).json({ error: 'Failed to load your servers.' });
    }
});

router.get('/guilds/:guildId/config', requireAuth, requireGuildAccess, async (req, res) => {
    try {
        const config = await getGuildConfig(req.bot, req.guild.id);

        res.json({
            modRole: config.modRole || null,
            adminRole: config.adminRole || null,
            logChannelId: config.logChannelId || null,
            welcomeChannel: config.welcomeChannel || null,
            welcomeMessage: config.welcomeMessage || ''
        });
    } catch (error) {
        logger.error(`Failed to load config for guild ${req.guild.id}: ${error.message}`);
        res.status(500).json({ error: 'Failed to load server configuration.' });
    }
});

router.patch('/guilds/:guildId/config', requireAuth, requireGuildAccess, async (req, res) => {
    try {
        const { modRole, adminRole, logChannelId, welcomeChannel, welcomeMessage } = req.body || {};
        const updates = {};

        if (modRole !== undefined) updates.modRole = modRole || null;
        if (adminRole !== undefined) updates.adminRole = adminRole || null;
        if (logChannelId !== undefined) updates.logChannelId = logChannelId || null;
        if (welcomeChannel !== undefined) updates.welcomeChannel = welcomeChannel || null;
        if (welcomeMessage !== undefined) updates.welcomeMessage = welcomeMessage;

        const saved = await updateGuildConfig(req.bot, req.guild.id, updates);
        res.json({ success: true, config: saved });
    } catch (error) {
        logger.error(`Failed to update config for guild ${req.guild.id}: ${error.message}`);
        res.status(400).json({ error: error.userMessage || 'Failed to save server configuration.' });
    }
});

router.get('/guilds/:guildId/channels', requireAuth, requireGuildAccess, async (req, res) => {
    try {
        const channels = req.guild.channels.cache
            .filter((channel) => typeof channel.isTextBased === 'function' && channel.isTextBased() && !channel.isThread())
            .map((channel) => ({ id: channel.id, name: channel.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ channels });
    } catch (error) {
        logger.error(`Failed to list channels for guild ${req.guild.id}: ${error.message}`);
        res.status(500).json({ error: 'Failed to load channels.' });
    }
});

router.get('/guilds/:guildId/roles', requireAuth, requireGuildAccess, async (req, res) => {
    try {
        const roles = req.guild.roles.cache
            .filter((role) => role.id !== req.guild.id) // drop @everyone
            .map((role) => ({ id: role.id, name: role.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ roles });
    } catch (error) {
        logger.error(`Failed to list roles for guild ${req.guild.id}: ${error.message}`);
        res.status(500).json({ error: 'Failed to load roles.' });
    }
});

export default router;
