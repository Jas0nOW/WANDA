import * as readline from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import type { AgentBus } from '@wanda/agent-bus';
import type { InboundMessage } from '@wanda/shared';

export class CliAdapter {
    private rl: readline.Interface;

    constructor(private bus: AgentBus, private userId: string = 'cli-user-1') {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Listen for outbound messages targeting the CLI payload
        this.bus.onOutbound((msg) => {
            if (msg.platform === 'cli' || msg.recipientId === this.userId) {
                console.log(`\n\x1b[36mWanda:\x1b[0m ${msg.text}`);
                this.prompt();
            }
        });

        // Listen for system events or LLM reasoning
        this.bus.onSystemEvent((event) => {
            if (event.type === 'llm_thought') {
                console.log(`\n\x1b[90m🤔 Thinking: ${event.payload.tool}...\x1b[0m`);
            }
        });
    }

    public async start() {
        console.log("\x1b[35mWanda CLI Adapter Online.\x1b[0m Type '/quit' to exit.");
        this.prompt();
        this.readLoop();
    }

    private prompt() {
        process.stdout.write('\x1b[32mYou:\x1b[0m ');
    }

    private async readLoop() {
        for await (const line of this.rl) {
            const text = line.trim();
            if (text.toLowerCase() === '/quit' || text.toLowerCase() === 'exit') {
                console.log("Shutting down CLI...");
                this.rl.close();
                process.exit(0);
            }
            if (text) {
                const inbound: InboundMessage = {
                    id: randomUUID(),
                    channelId: 'cli-terminal',
                    sender: {
                        userId: this.userId,
                        platform: 'cli',
                        username: 'JannisTerminal'
                    },
                    text: text,
                    timestamp: new Date().toISOString()
                };

                this.bus.ingest(inbound);
            } else {
                this.prompt();
            }
        }
    }
}
