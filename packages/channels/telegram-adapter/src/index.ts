import { Bot } from "grammy";
import { randomUUID } from "node:crypto";
import type { AgentBus } from "@wanda/agent-bus";
import type { InboundMessage } from "@wanda/shared";

export class TelegramAdapter {
    private bot: Bot;

    constructor(private bus: AgentBus, token: string, private adminId: string) {
        this.bot = new Bot(token);

        // Handle incoming messages
        this.bot.on("message:text", async (ctx) => {
            const userId = ctx.from?.id.toString();
            if (!userId) return;

            // Simple security: Only allow the admin
            if (userId !== this.adminId) {
                console.log(`[Telegram] Unauthorized access attempt from ${userId}`);
                await ctx.reply("Unauthorized. This instance is locked.");
                return;
            }

            const inbound: InboundMessage = {
                id: randomUUID(),
                channelId: 'telegram-main',
                sender: {
                    userId: userId,
                    platform: 'telegram',
                    username: ctx.from.username || "Unknown"
                },
                text: ctx.message.text,
                timestamp: new Date().toISOString()
            };

            this.bus.ingest(inbound);
        });

        // Listen for outbound messages and route to Telegram
        this.bus.onOutbound(async (msg) => {
            if (msg.platform === 'telegram') {
                try {
                    await this.bot.api.sendMessage(msg.recipientId, msg.text, {
                        parse_mode: 'Markdown'
                    });
                } catch (err) {
                    console.error('[Telegram] Failed to send message:', err);
                }
            }
        });
    }

    public async start() {
        console.log("[Telegram] Starting bot polling...");
        this.bot.start({
            onStart: (botInfo) => {
                console.log(`[Telegram] Bot @${botInfo.username} online.`);
            }
        });
    }

    public stop() {
        this.bot.stop();
    }
}
