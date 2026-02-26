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
async function main() {
    const app = express();
    app.use(cors());
    // 1. Initialize Memory MCP Server
    // For Tier 2 (SQLite Graph) and Tier 3 (Markdown), we need the data directory
    const memoryDataDir = path.join(config.dataDir, 'memory');
    // We instantiate the managers
    const graph = createGraphManager(memoryDataDir, logger);
    const journals = await createJournalManager(memoryDataDir, logger);
    // Supabase Archive requires URL/Key, using dummy for now if missing
    const archive = createArchiveManager(process.env['SUPABASE_URL'] || 'https://xotcufmlrfdthnpeasqi.supabase.co', process.env['SUPABASE_KEY'] || 'dummy-key', logger);
    const memoryServer = createMemoryMcpServer(graph, journals, archive, logger);
    // 2. Initialize Workspace MCP Server
    const workspaceHost = new WorkspaceMcpServer();
    const workspaceServer = workspaceHost.server;
    // 3. Keep track of active SSE Transports
    let memoryTransport = null;
    let workspaceTransport = null;
    // --- MEMORY MCP ROUTES ---
    app.get('/mcp/memory/sse', async (req, res) => {
        logger.info('New SSE connection for Memory MCP');
        memoryTransport = new SSEServerTransport('/mcp/memory/messages', res);
        await memoryServer.connect(memoryTransport);
    });
    app.post('/mcp/memory/messages', express.json(), async (req, res) => {
        if (!memoryTransport) {
            res.status(400).send('No active SSE connection for Memory');
            return;
        }
        await memoryTransport.handlePostMessage(req, res);
    });
    // --- WORKSPACE MCP ROUTES ---
    app.get('/mcp/workspace/sse', async (req, res) => {
        logger.info('New SSE connection for Workspace MCP');
        workspaceTransport = new SSEServerTransport('/mcp/workspace/messages', res);
        await workspaceServer.connect(workspaceTransport);
    });
    app.post('/mcp/workspace/messages', express.json(), async (req, res) => {
        if (!workspaceTransport) {
            res.status(400).send('No active SSE connection for Workspace');
            return;
        }
        await workspaceTransport.handlePostMessage(req, res);
    });
    // Healthcheck
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'wanda-hub', version: '0.1.0' });
    });
    // Start listening
    const port = process.env.PORT || 3000;
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
//# sourceMappingURL=index.js.map