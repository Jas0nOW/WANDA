import express from 'express';
import cors from 'cors';
import { pino } from 'pino';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { loadConfig } from '@wanda/shared';
import { createGraphManager, createJournalManager, createArchiveManager, createMemoryMcpServer } from '@wanda/memory';
import { WorkspaceMcpServer } from '@wanda/workspace-mcp';
import * as path from 'node:path';

const config = loadConfig();
const logger = pino({ level: config.logLevel || 'info' });
const port = Number(process.env.PORT || 3000);
const allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];

async function main() {
    const app = express();
    app.use(cors());

    // 1. Initialize Memory MCP Server
    // For Tier 2 (SQLite Graph) and Tier 3 (Markdown), we need the data directory
    const memoryDataDir = path.join(config.dataDir, 'memory');

    // We instantiate the managers
    const graph = createGraphManager(memoryDataDir, logger as any);
    const journals = await createJournalManager(memoryDataDir, logger as any);
    // Supabase Archive requires URL/Key, using dummy for now if missing
    const archive = createArchiveManager(
        process.env['SUPABASE_URL'] || 'https://xotcufmlrfdthnpeasqi.supabase.co',
        process.env['SUPABASE_KEY'] || 'dummy-key',
        logger as any
    );

    const memoryServer = createMemoryMcpServer(graph, journals, archive, logger as any);

    // 2. Initialize Workspace MCP Server
    const workspaceHost = new WorkspaceMcpServer();
    const workspaceServer = workspaceHost.server;

    // 3. Keep active SSE transports keyed by sessionId (multi-client safe)
    const memoryTransports = new Map<string, SSEServerTransport>();
    const workspaceTransports = new Map<string, SSEServerTransport>();

    // --- MEMORY MCP ROUTES ---
    app.get('/mcp/memory/sse', async (_req, res) => {
        logger.info('New SSE connection for Memory MCP');
        const transport = new SSEServerTransport('/mcp/memory/messages', res, {
            enableDnsRebindingProtection: true,
            allowedHosts
        });
        memoryTransports.set(transport.sessionId, transport);
        transport.onclose = () => {
            memoryTransports.delete(transport.sessionId);
        };
        await memoryServer.connect(transport);
    });

    app.post('/mcp/memory/messages', express.json(), async (req, res) => {
        const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
        if (!sessionId) {
            res.status(400).send('Missing sessionId');
            return;
        }
        const transport = memoryTransports.get(sessionId);
        if (!transport) {
            res.status(400).send('No active SSE connection for Memory session');
            return;
        }
        await transport.handlePostMessage(req, res);
    });

    // --- WORKSPACE MCP ROUTES ---
    app.get('/mcp/workspace/sse', async (_req, res) => {
        logger.info('New SSE connection for Workspace MCP');
        const transport = new SSEServerTransport('/mcp/workspace/messages', res, {
            enableDnsRebindingProtection: true,
            allowedHosts
        });
        workspaceTransports.set(transport.sessionId, transport);
        transport.onclose = () => {
            workspaceTransports.delete(transport.sessionId);
        };
        await workspaceServer.connect(transport);
    });

    app.post('/mcp/workspace/messages', express.json(), async (req, res) => {
        const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
        if (!sessionId) {
            res.status(400).send('Missing sessionId');
            return;
        }
        const transport = workspaceTransports.get(sessionId);
        if (!transport) {
            res.status(400).send('No active SSE connection for Workspace session');
            return;
        }
        await transport.handlePostMessage(req, res);
    });

    // Healthcheck
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'wanda-hub', version: '0.1.0' });
    });

    // Start listening
    app.listen(port, () => {
        logger.info(`WANDA Hub running on http://localhost:${port}`);
        logger.info(` -> Memory MCP SSE:     http://localhost:${port}/mcp/memory/sse`);
        logger.info(` -> Workspace MCP SSE:  http://localhost:${port}/mcp/workspace/sse`);
    });
}

main().catch(err => {
    console.error('Fatal Hub Error:', err);
    process.exit(1);
});
