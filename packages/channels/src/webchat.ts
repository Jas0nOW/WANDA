import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { extname, join } from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import type { InboundMessage, OutboundMessage, Logger, MessageMedia } from '@wanda/shared';
import type { ChannelAdapter } from './adapter.js';
import type { PairingServiceInterface } from './pairing.js';

export interface WebChatAdapterConfig {
    port: number;
    publicDir: string;
    adminId: string;
}

interface WsPayload {
    type: string;
    text?: string;
    media?: Array<{ type: string; url: string; mimeType?: string }>;
    config?: {
        model?: string;
        reasoning?: 'low' | 'high';
        thinking?: boolean;
    };
    [key: string]: any;
}

export function createWebChatAdapter(
    config: WebChatAdapterConfig,
    pairing: PairingServiceInterface,
    logger: Logger,
): ChannelAdapter {
    let server: Server | undefined;
    let wss: WebSocketServer | undefined;
    let messageHandler: ((msg: InboundMessage) => Promise<void>) | undefined;

    // Single static admin user for the web UI since we only have single user access currently
    // In the future this could be paired via OAuth on the frontend
    const webUserId = config.adminId;

    const MIME_TYPES: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.svg': 'image/svg+xml',
    };

    function serveStaticFile(req: IncomingMessage, res: ServerResponse) {
        let filePath = req.url === '/' || !req.url ? '/index.html' : req.url;
        // prevent directory traversal
        filePath = filePath.replace(/\\/g, '/').replace(/\.\./g, '');

        const absolutePath = join(config.publicDir, filePath);
        logger.info({ filePath, absolutePath, publicDir: config.publicDir }, 'serveStaticFile: Resolving path');

        if (!existsSync(absolutePath)) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const ext = extname(absolutePath);
        const contentType = MIME_TYPES[ext] || 'text/plain';

        res.writeHead(200, { 'Content-Type': contentType });
        createReadStream(absolutePath).pipe(res);
    }

    function registerWsHandlers(wsServer: WebSocketServer) {
        wsServer.on('connection', (ws) => {
            logger.info('WebChat client connected');

            ws.on('message', async (data) => {
                try {
                    const payload = JSON.parse(data.toString()) as WsPayload;

                    if (payload.type === 'command' && payload.command === 'restart') {
                        logger.warn('UI requested backend restart via WebChat. Exiting process...');
                        setTimeout(() => process.exit(0), 500);
                        return;
                    }

                    if (payload.type === 'message') {
                        const inbound: InboundMessage = {
                            id: Date.now().toString(),
                            channelId: 'webchat',
                            sender: { userId: webUserId, platform: 'webchat', username: 'Admin' },
                            text: payload.text || '',
                            timestamp: new Date().toISOString(),
                            isGroupChat: false,
                            media: payload.media as MessageMedia[] | undefined,
                            overrides: payload.config ? {
                                model: payload.config.model,
                                // Custom args we can pass through to the router if needed
                                reasoning: payload.config.reasoning,
                                thinking: payload.config.thinking
                            } : undefined
                        };

                        if (messageHandler) {
                            await messageHandler(inbound);
                        }
                    }
                } catch (err) {
                    logger.error({ err }, 'Failed to parse WebChat WS message');
                }
            });

            ws.on('close', () => {
                logger.info('WebChat client disconnected');
            });

            // Send an initial handshake/config payload if needed
            ws.send(JSON.stringify({ type: 'connected' }));
        });
    }

    async function tryStartOnPort(port: number): Promise<boolean> {
        const candidateServer = createServer((req, res) => {
            serveStaticFile(req, res);
        });
        const candidateWss = new WebSocketServer({ server: candidateServer });
        registerWsHandlers(candidateWss);

        return new Promise<boolean>((resolve, reject) => {
            let settled = false;

            const finalize = (result: boolean, err?: Error) => {
                if (settled) return;
                settled = true;
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            };

            const handleAddressInUse = () => {
                candidateWss.close();
                try {
                    candidateServer.close();
                } catch {
                    // ignored: close can throw if not listening yet
                }
                finalize(false);
            };

            const onListenError = (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    handleAddressInUse();
                    return;
                }
                finalize(false, err);
            };

            candidateServer.once('error', onListenError);
            candidateWss.once('error', (err) => onListenError(err as NodeJS.ErrnoException));

            try {
                candidateServer.listen(port, () => {
                    server = candidateServer;
                    wss = candidateWss;
                    finalize(true);
                });
            } catch (err) {
                const listenErr = err as NodeJS.ErrnoException;
                if (listenErr.code === 'EADDRINUSE') {
                    handleAddressInUse();
                    return;
                }
                finalize(false, listenErr);
            }
        });
    }

    return {
        id: 'webchat',

        async start() {
            const retriesRaw = Number(process.env['WEBCHAT_PORT_RETRIES'] ?? 10);
            const maxRetries = Number.isFinite(retriesRaw) && retriesRaw >= 0 ? Math.floor(retriesRaw) : 10;

            for (let retry = 0; retry <= maxRetries; retry += 1) {
                const port = config.port + retry;
                const started = await tryStartOnPort(port);
                if (!started) {
                    logger.warn(
                        { port, retry: retry + 1, maxAttempts: maxRetries + 1 },
                        'WebChat port in use, trying next port',
                    );
                    continue;
                }

                if (port !== config.port) {
                    logger.warn(
                        { requestedPort: config.port, selectedPort: port },
                        'WebChat fallback port selected',
                    );
                }
                logger.info({ port }, 'WebChat server listening');
                return;
            }

            throw new Error(`WebChat could not bind any port in range ${config.port}-${config.port + maxRetries}`);
        },

        async stop() {
            const activeWss = wss;
            const activeServer = server;
            if (!activeWss || !activeServer) return;
            return new Promise<void>((resolve, reject) => {
                activeWss.close((err) => {
                    if (err) logger.error({ err }, 'Error closing WSS');
                    activeServer.close((err2) => {
                        if (err2) return reject(err2);
                        wss = undefined;
                        server = undefined;
                        logger.info('WebChat server stopped');
                        resolve();
                    });
                });
            });
        },

        async sendMessage(msg: OutboundMessage) {
            if (!wss) return;
            // Include metadata if present (to support custom message types like 'models')
            const basePayload = {
                type: 'message',
                role: 'assistant',
                text: msg.text,
                media: msg.media,
            };

            const payload = JSON.stringify(msg.metadata ? { ...basePayload, ...msg.metadata } : basePayload);

            // Broadcast to all connected clients (assuming single-tenant for now)
            for (const client of wss.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                }
            }
        },

        onMessage(handler: (msg: InboundMessage) => Promise<void>) {
            messageHandler = handler;
        },
    };
}
