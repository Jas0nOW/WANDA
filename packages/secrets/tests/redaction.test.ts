import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger, redactSecrets } from '@wanda/shared';
import { createSecretStore } from '../src/store.js';
import { hasSecretRefs, resolveSecrets } from '../src/resolver.js';

const tempDirs: string[] = [];

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('secret resolver + redaction', () => {
    it('resolves secret handles but allows safe redaction before output', () => {
        const dataDir = mkdtempSync(join(tmpdir(), 'wanda-secrets-'));
        tempDirs.push(dataDir);

        const store = createSecretStore(
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            dataDir,
            createLogger({ level: 'silent', name: 'secrets-test' }),
        );

        try {
            store.set('openai-key', 'sk-proj-super-secret-value-1234567890');

            const input = 'Authorization uses secret://openai-key';
            expect(hasSecretRefs(input)).toBe(true);

            const resolved = resolveSecrets(input, store);
            expect(resolved).toContain('sk-proj-super-secret-value-1234567890');

            const redacted = redactSecrets(resolved);
            expect(redacted).not.toContain('sk-proj-super-secret-value-1234567890');
            expect(redacted).toContain('[REDACTED]');
        } finally {
            store.close();
        }
    });

    it('throws for unknown secret handles', () => {
        const dataDir = mkdtempSync(join(tmpdir(), 'wanda-secrets-'));
        tempDirs.push(dataDir);

        const store = createSecretStore(
            'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            dataDir,
            createLogger({ level: 'silent', name: 'secrets-test' }),
        );

        try {
            expect(() => resolveSecrets('use secret://missing', store)).toThrow(
                'Secret not found: secret://missing',
            );
        } finally {
            store.close();
        }
    });
});
