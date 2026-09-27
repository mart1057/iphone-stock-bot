import { isLineConfigured } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { discordNotificationService } from './discord.service.js';
import { lineNotificationService } from './line.service.js';
import { telegramNotificationService } from './telegram.service.js';
/// Adapts the existing Flex-only LINE client to the channel interface.
class LineChannel {
    line;
    name = 'line';
    constructor(line = lineNotificationService) {
        this.line = line;
    }
    isConfigured() {
        return isLineConfigured();
    }
    isAvailable() {
        return this.line.isAvailable();
    }
    async send(message, retryKey) {
        const result = await this.line.push(message.flex, retryKey);
        return {
            channel: this.name,
            success: result.success,
            messageId: result.messageId,
            skipped: false,
            error: result.error,
        };
    }
}
/**
 * Fans one notification out to every configured channel.
 *
 * A notification counts as delivered when AT LEAST ONE channel accepted it.
 * That is deliberate: when LINE's monthly quota runs out mid-month, Telegram
 * or Discord keeps the alerts flowing instead of the whole bot going silent.
 */
export class ChannelDispatcher {
    channels;
    constructor(channels = [
        new LineChannel(),
        telegramNotificationService,
        discordNotificationService,
    ]) {
        this.channels = channels;
    }
    configured() {
        return this.channels.filter((channel) => channel.isConfigured());
    }
    /// Configured AND currently usable - a quota-exhausted channel is excluded
    /// so we stop making calls that can only fail.
    usable() {
        return this.configured().filter((channel) => channel.isAvailable?.() ?? true);
    }
    async push(message, retryKey) {
        const active = this.usable();
        if (active.length === 0) {
            // Say which of the two it is - "not configured" and "all channels are
            // temporarily down" need very different fixes from the user.
            const error = this.configured().length === 0
                ? 'No notification channel configured (LINE / Telegram / Discord)'
                : `Every configured channel is unavailable (${this.configured()
                    .map((channel) => channel.name)
                    .join(', ')}) - configure Telegram or Discord as a backup`;
            logger.error('Notification skipped', error);
            return { success: false, messageId: null, error, results: [] };
        }
        const results = await Promise.all(active.map((channel) => channel.send(message, retryKey).catch((error) => ({
            channel: channel.name,
            success: false,
            messageId: null,
            skipped: false,
            error: error instanceof Error ? error.message : String(error),
        }))));
        const delivered = results.filter((result) => result.success);
        const failed = results.filter((result) => !result.success && !result.skipped);
        for (const failure of failed) {
            logger.error(`Channel "${failure.channel}" failed`, failure.error);
        }
        return {
            success: delivered.length > 0,
            messageId: delivered.find((result) => result.messageId)?.messageId ?? null,
            error: failed.length > 0
                ? failed.map((result) => `${result.channel}: ${result.error}`).join('; ')
                : undefined,
            results,
        };
    }
}
export const channelDispatcher = new ChannelDispatcher();
//# sourceMappingURL=channels.js.map