// =============================================================================
// Wanda — Telegram Channel Adapter (grammY, long polling)
// =============================================================================
// Normalizes Telegram messages into InboundMessage. Drops unknown users.
// Notifies admin of pairing requests. Handles /pair commands.

import { Bot, InlineKeyboard } from 'grammy';
import type { InboundMessage, OutboundMessage, MessageMedia, Logger } from '@wanda/shared';
import type { ChannelAdapter } from './adapter.js';
import type { PairingServiceInterface } from './pairing.js';

export interface TelegramAdapterConfig {
    readonly botToken: string;
    readonly adminTelegramId: string;
    readonly adminTelegramChatId: string;
}

export function createTelegramAdapter(
    config: TelegramAdapterConfig,
    pairing: PairingServiceInterface,
    logger: Logger,
): ChannelAdapter {
    const bot = new Bot(config.botToken);
    let messageHandler: ((msg: InboundMessage) => Promise<void>) | null = null;
    let pollingActive = false;

    function isPollingConflictError(err: unknown): boolean {
        if (!err || typeof err !== 'object') return false;
        const maybeErr = err as { error_code?: number; description?: string };
        if (maybeErr.error_code === 409) return true;
        if (typeof maybeErr.description === 'string' && maybeErr.description.includes('terminated by other getUpdates request')) {
            return true;
        }
        return false;
    }

    bot.command('pair', async (ctx) => {
        const senderId = String(ctx.from?.id ?? '');
        if (!pairing.isAdmin(senderId)) {
            // Non-admin trying to use /pair — silent ignore
            return;
        }

        const args = ctx.match?.trim().split(/\s+/) ?? [];
        const subcommand = args[0];

        if (subcommand === 'approve' && args[1]) {
            const otp = args[1];
            const success = pairing.approvePairing(otp);
            if (success) {
                await ctx.reply(`✅ Pairing approved (OTP: ${otp})`);
            } else {
                await ctx.reply(`❌ No pending pairing found for OTP: ${otp}`);
            }
            return;
        }

        if (subcommand === 'revoke' && args[1] && args[2]) {
            const targetUserId = args[1];
            const platform = args[2];
            const success = pairing.revokePairing(targetUserId, platform);
            if (success) {
                await ctx.reply(`🚫 Pairing revoked for ${targetUserId} (${platform})`);
            } else {
                await ctx.reply(`❌ No pairing found for ${targetUserId} (${platform})`);
            }
            return;
        }

        await ctx.reply(
            'Usage:\n' +
            '/pair approve <otp> — Approve a pending pairing\n' +
            '/pair revoke <userId> <platform> — Revoke a pairing',
        );
    });

    bot.on(['message', 'callback_query:data'], async (ctx) => {
        let userId: string;
        let username: string | undefined;
        let text = '';
        let isGroupChat = false;
        let messageId: string | undefined;
        let replyToId: string | undefined;
        let callbackQueryId: string | undefined;
        let timestamp: string = new Date().toISOString();
        const media: MessageMedia[] = [];

        if (ctx.callbackQuery) {
            userId = String(ctx.callbackQuery.from.id);
            username = ctx.callbackQuery.from.username ?? ctx.callbackQuery.from.first_name;
            text = ctx.callbackQuery.data;
            callbackQueryId = ctx.callbackQuery.id;
            messageId = String(ctx.callbackQuery.message?.message_id ?? Date.now());
            if (ctx.callbackQuery.message?.chat.type === 'group' || ctx.callbackQuery.message?.chat.type === 'supergroup') {
                isGroupChat = true;
            }
            try { await ctx.answerCallbackQuery(); } catch { }
        } else if (ctx.message) {
            if (!ctx.from) return;
            userId = String(ctx.from.id);
            username = ctx.from.username ?? ctx.from.first_name;

            // Skip commands
            if (ctx.message.text?.startsWith('/')) return;

            text = ctx.message.text ?? ctx.message.caption ?? '';
            messageId = String(ctx.message.message_id);
            timestamp = new Date(ctx.message.date * 1000).toISOString();
            replyToId = ctx.message.reply_to_message ? String(ctx.message.reply_to_message.message_id) : undefined;
            isGroupChat = ctx.message.chat.type === 'group' || ctx.message.chat.type === 'supergroup';

            if (ctx.message.photo && ctx.message.photo.length > 0) {
                const largest = ctx.message.photo[ctx.message.photo.length - 1];
                if (largest) {
                    media.push({ type: 'photo', url: `telegram://${largest.file_id}` });
                }
            }
            if (ctx.message.voice) {
                media.push({ type: 'voice', url: `telegram://${ctx.message.voice.file_id}`, mimeType: ctx.message.voice.mime_type });
            }
            if (ctx.message.document) {
                media.push({ type: 'document', url: `telegram://${ctx.message.document.file_id}`, mimeType: ctx.message.document.mime_type });
            }
            if (ctx.message.video) {
                media.push({ type: 'video', url: `telegram://${ctx.message.video.file_id}`, mimeType: ctx.message.video.mime_type });
            }

            // Ignore completely empty messages without text or media
            if (!text && media.length === 0) return;
        } else {
            return;
        }

        // --- Pairing check ---
        const user = pairing.getPairedUser(userId, 'telegram');

        if (!user || user.status !== 'approved') {
            logger.info({ userId, username }, 'Unknown user message — silent drop');

            if (!user || user.status !== 'pending') {
                const request = pairing.createPairingRequest(userId, 'telegram', username);
                try {
                    await bot.api.sendMessage(
                        config.adminTelegramChatId,
                        `🔔 Pairing request:\nUser: ${username ?? 'unknown'} (${userId})\nOTP: \`${request.otp}\`\n\nApprove: \`/pair approve ${request.otp}\``,
                        { parse_mode: 'Markdown' },
                    );
                } catch (err) {
                    logger.error({ err }, 'Failed to notify admin of pairing request');
                }
            }
            return;
        }

        // --- Paired user → normalize and forward ---
        const inbound: InboundMessage = {
            id: messageId,
            channelId: 'telegram',
            sender: { userId, platform: 'telegram', username },
            text,
            timestamp,
            replyToMessageId: replyToId,
            isGroupChat,
            media: media.length > 0 ? media : undefined,
            callbackQueryId
        };

        if (messageHandler) {
            try {
                await messageHandler(inbound);
            } catch (err) {
                logger.error({ err }, 'Error in message handler');
            }
        }
    });

    return {
        id: 'telegram',

        async start(): Promise<void> {
            logger.info('Starting Telegram adapter (long polling)');
            try {
                await bot.start({ onStart: () => logger.info('Telegram bot started') });
                pollingActive = true;
            } catch (err) {
                if (isPollingConflictError(err)) {
                    logger.warn(
                        { err },
                        'Telegram polling conflict (409). Continuing without Telegram polling. Use `wanda kill` to clear stale bot instance.',
                    );
                    pollingActive = false;
                    return;
                }
                throw err;
            }
        },

        async stop(): Promise<void> {
            logger.info('Stopping Telegram adapter');
            if (!pollingActive) return;
            await bot.stop();
            pollingActive = false;
        },

        async sendMessage(msg: OutboundMessage): Promise<void> {
            let reply_markup = undefined;
            if (msg.keyboard && msg.keyboard.length > 0) {
                reply_markup = new InlineKeyboard();
                for (const row of msg.keyboard) {
                    for (const btn of row) {
                        if (btn.url) reply_markup.url(btn.text, btn.url);
                        else if (btn.callbackData) reply_markup.text(btn.text, btn.callbackData);
                    }
                    reply_markup.row();
                }
            }

            const sendOpts = {
                reply_parameters: msg.replyToMessageId ? { message_id: Number(msg.replyToMessageId) } : undefined,
                reply_markup
            };

            const firstPhoto = msg.media?.find(m => m.type === 'photo');
            if (firstPhoto && firstPhoto.url.startsWith('telegram://')) {
                const fileId = firstPhoto.url.replace('telegram://', '');
                await bot.api.sendPhoto(msg.recipientId, fileId, { caption: msg.text, parse_mode: 'Markdown', ...sendOpts });
            } else {
                await bot.api.sendMessage(msg.recipientId, msg.text, { parse_mode: 'Markdown', ...sendOpts });
            }
        },

        onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
            messageHandler = handler;
        },
    };
}
