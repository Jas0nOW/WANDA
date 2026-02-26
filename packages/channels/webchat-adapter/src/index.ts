import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { AgentBus } from '@wanda/agent-bus';
import type { InboundMessage } from '@wanda/shared';

export class WebChatAdapter {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();

    constructor(private bus: AgentBus, private port: number = 8080) {
        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('connection', (ws) => {
            console.log(`[WebChat] Client connected on port ${this.port}`);
            this.clients.add(ws);

            ws.on('message', (data) => {
                try {
                    const parsed = JSON.parse(data.toString());

                    const inbound: InboundMessage = {
                        id: randomUUID(),
                        channelId: 'webchat-main',
                        sender: {
                            userId: parsed.userId || 'web-user',
                            platform: 'webchat',
                            username: 'Web User'
                        },
                        text: parsed.text,
                        timestamp: new Date().toISOString()
                    };

                    this.bus.ingest(inbound);

                } catch (e) {
                    console.error('[WebChat] Malformed JSON from client:', e);
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`[WebChat] Client disconnected.`);
            });
        });

        // Listen to bus for outbound messages
        this.bus.onOutbound((msg) => {
            if (msg.platform === 'webchat') {
                const payload = JSON.stringify(msg);
                for (const client of this.clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(payload);
                    }
                }
            }
        });
    }

    public start() {
        console.log(`[WebChat] WebSocket Server listening on ws://localhost:${this.port}`);
    }
}
