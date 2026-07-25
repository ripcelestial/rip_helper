import { ModerationService } from './moderationService.js';
import logger from '../utils/logger.js';

/**
 * After a warning is added, check whether the user just crossed a
 * mute/kick/ban threshold set on the dashboard, and apply that
 * punishment automatically if so.
 *
 * Only fires exactly ON the threshold count (not every warning after it),
 * so someone doesn't get kicked again on warning #6 after already being
 * kicked at #3.
 *
 * Ban takes priority over kick, which takes priority over mute, since
 * a server admin would normally set ban at a higher count than kick/mute.
 */
export async function applyWarnThresholdPunishment({ guild, member, target, totalWarns, config }) {
    if (!config) return { applied: false };

    const botMember = guild.members.me;
    if (!botMember) return { applied: false };

    try {
        if (config.warnBanThreshold && totalWarns === Number(config.warnBanThreshold)) {
            await ModerationService.banUser({
                guild,
                user: target,
                moderator: botMember,
                reason: `Automatic ban: reached ${totalWarns} warnings`
            });
            return { applied: true, action: 'ban' };
        }

        if (config.warnKickThreshold && totalWarns === Number(config.warnKickThreshold)) {
            await ModerationService.kickUser({
                guild,
                member,
                moderator: botMember,
                reason: `Automatic kick: reached ${totalWarns} warnings`
            });
            return { applied: true, action: 'kick' };
        }

        if (config.warnMuteThreshold && totalWarns === Number(config.warnMuteThreshold)) {
            const durationMinutes = Number(config.warnMuteDurationMinutes) || 60;
            await ModerationService.timeoutUser({
                guild,
                member,
                moderator: botMember,
                durationMs: durationMinutes * 60 * 1000,
                reason: `Automatic mute: reached ${totalWarns} warnings`
            });
            return { applied: true, action: 'mute', durationMinutes };
        }
    } catch (error) {
        // Auto-punishment failing (e.g. bot's role too low) should never
        // block the warning itself from going through.
        logger.error(`Auto-punishment failed for ${target?.id} in guild ${guild?.id}: ${error.message}`);
    }

    return { applied: false };
}
