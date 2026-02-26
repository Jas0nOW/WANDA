import 'dotenv/config';
import { bus } from '@wanda/agent-bus';
import { SwarmManager } from '@wanda/swarm-manager';
import { CliAdapter } from '@wanda/cli-adapter';
import { TelegramAdapter } from '@wanda/telegram-adapter';

async function main() {
    console.log("=========================================");
    console.log("   W.A.N.D.A. Core Intelligence Online   ");
    console.log("=========================================\n");

    // Enable Agent Bus
    console.log("[Wanda] AgentBus initialized.");

    // Initialize Swarm Engine
    console.log("[Wanda] Booting SwarmManager...");
    // Assuming Hub is running on localhost:3000
    const swarm = new SwarmManager(bus, 'http://localhost:3000');
    await swarm.start(); // This connects SSE to the Hub

    // Load Adapters based on ENV
    if (process.env.ENABLE_CLI === 'true' || process.env.NODE_ENV !== 'production') {
        const cli = new CliAdapter(bus);
        cli.start();
    }

    if (process.env.TELEGRAM_BOT_TOKEN) {
        const adminId = process.env.TELEGRAM_ADMIN_ID || '0';
        const tg = new TelegramAdapter(bus, process.env.TELEGRAM_BOT_TOKEN, adminId);
        tg.start();
    }

    if (process.env.ENABLE_WEBCHAT === 'true' || process.env.NODE_ENV !== 'production') {
        // dynamic import to avoid crashes if webchat is disabled
        const { WebChatAdapter } = await import('@wanda/webchat-adapter');
        const wc = new WebChatAdapter(bus, 8080);
        wc.start();
    }

    if (process.env.ENABLE_VOICE === 'true' || process.env.NODE_ENV !== 'production') {
        const { VoxVoiceSink } = await import('@wanda/vox-voice-sink');
        new VoxVoiceSink(bus);
        console.log('[Wanda] Vox Voice Sink enabled.');
    }

    console.log("\n[Wanda] All systems nominal. Waiting for input...\n");
}

main().catch(err => {
    console.error("Fatal Error booting Wanda:", err);
    process.exit(1);
});
