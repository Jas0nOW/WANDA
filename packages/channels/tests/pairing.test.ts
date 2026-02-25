import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { createLogger } from '@wanda/shared';
import { createPairingService } from '../src/pairing.js';

const tempDirs: string[] = [];

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('pairing service', () => {
    it('keeps unknown users unapproved until explicit admin OTP approval', () => {
        const dataDir = mkdtempSync(join(tmpdir(), 'wanda-channels-pairing-'));
        tempDirs.push(dataDir);

        const service = createPairingService(
            {
                dataDir,
                adminTelegramId: 'admin-1',
            },
            createLogger({ level: 'silent', name: 'pairing-test' }),
        );

        try {
            const adminTelegram = service.getPairedUser('admin-1', 'telegram');
            const adminWebchat = service.getPairedUser('admin-1', 'webchat');
            expect(adminTelegram?.status).toBe('approved');
            expect(adminWebchat?.status).toBe('approved');

            expect(service.getPairedUser('unknown-42', 'telegram')).toBeUndefined();

            const request = service.createPairingRequest('unknown-42', 'telegram', 'new-user');
            expect(request.otp).toMatch(/^\d{6}$/);

            const pending = service.getPairedUser('unknown-42', 'telegram');
            expect(pending?.status).toBe('pending');
            expect(pending?.username).toBe('new-user');

            const approved = service.approvePairing(request.otp);
            expect(approved).toBe(true);

            const paired = service.getPairedUser('unknown-42', 'telegram');
            expect(paired?.status).toBe('approved');
            expect(paired?.otp).toBeNull();
        } finally {
            service.close();
        }
    });
});
