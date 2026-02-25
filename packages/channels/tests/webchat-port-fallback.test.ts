import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from '@wanda/shared';
import { createPairingService } from '../src/pairing.js';
import { createWebChatAdapter } from '../src/webchat.js';

const tempDirs: string[] = [];

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('webchat adapter', () => {
    it('falls back to next free port when configured port is occupied', async () => {
        const dataDir = mkdtempSync(join(tmpdir(), 'wanda-channels-webchat-data-'));
        const publicDir = mkdtempSync(join(tmpdir(), 'wanda-channels-webchat-public-'));
        tempDirs.push(dataDir, publicDir);
        writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>ok</title>');

        const blocker = createServer((_req, res) => {
            res.statusCode = 200;
            res.end('blocked');
        });
        await new Promise<void>((resolve) => {
            blocker.listen(0, '127.0.0.1', () => resolve());
        });

        const occupiedPort = (blocker.address() as AddressInfo).port;
        const previousRetries = process.env['WEBCHAT_PORT_RETRIES'];
        process.env['WEBCHAT_PORT_RETRIES'] = '5';

        const logger = createLogger({ level: 'silent', name: 'webchat-fallback-test' });
        const pairing = createPairingService(
            { dataDir, adminTelegramId: 'admin-1' },
            logger,
        );
        const adapter = createWebChatAdapter(
            { port: occupiedPort, publicDir, adminId: 'admin-1' },
            pairing,
            logger,
        );

        try {
            await expect(adapter.start()).resolves.toBeUndefined();
        } finally {
            await adapter.stop();
            await new Promise<void>((resolve) => blocker.close(() => resolve()));
            pairing.close();
            if (previousRetries === undefined) {
                delete process.env['WEBCHAT_PORT_RETRIES'];
            } else {
                process.env['WEBCHAT_PORT_RETRIES'] = previousRetries;
            }
        }
    });
});
